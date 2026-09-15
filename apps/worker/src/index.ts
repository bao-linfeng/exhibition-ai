import { writeFile, unlink } from 'node:fs/promises';
import {
  Worker,
  probeQueue,
  createQueueConnection,
  env,
  logger,
} from '@exhibition/backend';

const heartbeat = env.WORKER_HEALTH_FILE;
const connection = createQueueConnection();
const worker = new Worker(
  probeQueue,
  async (job) => {
    if (job.name !== 'smoke' || typeof job.data?.nonce !== 'string')
      throw new Error('Unsupported probe');
    return { nonce: job.data.nonce, status: 'ok' };
  },
  { connection, concurrency: 1 },
);
worker.on('error', () => {
  logger.error('Worker connection error');
});
worker.on('failed', () => {
  logger.error('Worker probe failed');
});
let stopping = false;
let pulsing = false;
async function pulse() {
  if (pulsing || stopping) return;
  pulsing = true;
  try {
    await connection.ping();
    if (!stopping) await writeFile(heartbeat, String(Date.now()));
  } catch {
    await unlink(heartbeat).catch(() => {});
  } finally {
    pulsing = false;
  }
}
await worker.waitUntilReady();
await pulse();
const timer = setInterval(() => {
  void pulse();
}, 10000);
async function stop() {
  if (stopping) return;
  stopping = true;
  clearInterval(timer);
  await unlink(heartbeat).catch(() => {});
  await worker.close();
  connection.disconnect();
  await unlink(heartbeat).catch(() => {});
}
process.once('SIGINT', () => {
  void stop();
});
process.once('SIGTERM', () => {
  void stop();
});
logger.info('Local probe worker ready');
