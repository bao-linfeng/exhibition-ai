import { writeFile, unlink } from 'node:fs/promises';
import { S3Client } from '@aws-sdk/client-s3';
import {
  Worker,
  probeQueue,
  createQueueConnection,
  createAssetValidationQueue,
  QUEUE_ASSET_VALIDATION,
  env,
  logger,
  initDatabase,
  TaskRepository,
  TaskService,
  S3StorageProvider,
  AssetRepository,
} from '@exhibition/backend';
import { bootstrapProviders } from './bootstrap.js';
import { processAssetValidation } from './processors/asset-validation.processor.js';

const heartbeat = env.WORKER_HEALTH_FILE;
export const providers = bootstrapProviders();

// DB + services
const { db } = initDatabase();
const taskRepo = new TaskRepository(db);
const s3 = new S3StorageProvider(
  new S3Client({
    endpoint: env.S3_ENDPOINT,
    region: env.S3_REGION,
    forcePathStyle: true,
    credentials: {
      accessKeyId: env.S3_ACCESS_KEY,
      secretAccessKey: env.S3_SECRET_KEY,
    },
    maxAttempts: 1,
  }),
  env.S3_PUBLIC_ENDPOINT,
  env.S3_REGION,
);
const assetRepo = new AssetRepository(db);
const bucket = env.S3_BUCKET;

// Redis connections
const probeConnection = createQueueConnection();
const workerConnection = createQueueConnection();
const scannerConnection = createQueueConnection();

// Queues (for outbox relay)
const assetValidationQueue = createAssetValidationQueue({
  connection: workerConnection,
});
const queues = new Map([[QUEUE_ASSET_VALIDATION, assetValidationQueue]]);
const taskService = new TaskService(taskRepo, queues);

// Probe worker (existing)
const probeWorker = new Worker(
  probeQueue,
  async (job) => {
    if (job.name !== 'smoke' || typeof job.data?.nonce !== 'string')
      throw new Error('Unsupported probe');
    return { nonce: job.data.nonce, status: 'ok' };
  },
  { connection: probeConnection, concurrency: 1 },
);
probeWorker.on('error', () => {
  logger.error('Probe worker connection error');
});
probeWorker.on('failed', () => {
  logger.error('Probe worker job failed');
});

// Asset validation worker
const assetValidationWorker = new Worker(
  QUEUE_ASSET_VALIDATION,
  async (job) => {
    const data = job.data as {
      taskId: string;
      assetId: string;
      bucket: string;
      objectKey: string;
      projectId: string;
    };
    logger.info(
      { taskId: data.taskId, jobId: job.id },
      'Processing asset_validation task',
    );
    await processAssetValidation(data, {
      assetRepo,
      taskRepo,
      storage: s3,
      bucket,
    });
  },
  { connection: createQueueConnection(), concurrency: 5 },
);
assetValidationWorker.on('error', (err) => {
  logger.error({ err }, 'Asset validation worker error');
});
assetValidationWorker.on('failed', (job, err) => {
  logger.error({ jobId: job?.id, err }, 'Asset validation job failed');
});

// Heartbeat
let stopping = false;
let pulsing = false;
async function pulse() {
  if (pulsing || stopping) return;
  pulsing = true;
  try {
    await probeConnection.ping();
    if (!stopping) await writeFile(heartbeat, String(Date.now()));
  } catch {
    await unlink(heartbeat).catch(() => {});
  } finally {
    pulsing = false;
  }
}

// Outbox scanner: relay unpublished messages every 60 seconds
let scanning = false;
async function scanOutbox() {
  if (scanning || stopping) return;
  scanning = true;
  try {
    await taskService.scanAndRelayOutbox();
  } catch (err) {
    logger.warn({ err }, 'Outbox scan error');
  } finally {
    scanning = false;
  }
}

await Promise.all([
  probeWorker.waitUntilReady(),
  assetValidationWorker.waitUntilReady(),
]);
await pulse();

const heartbeatTimer = setInterval(() => {
  void pulse();
}, 10_000);
const outboxTimer = setInterval(() => {
  void scanOutbox();
}, 60_000);

async function stop() {
  if (stopping) return;
  stopping = true;
  clearInterval(heartbeatTimer);
  clearInterval(outboxTimer);
  await unlink(heartbeat).catch(() => {});
  await Promise.all([
    probeWorker.close(),
    assetValidationWorker.close(),
    assetValidationQueue.close(),
  ]);
  probeConnection.disconnect();
  workerConnection.disconnect();
  scannerConnection.disconnect();
  await unlink(heartbeat).catch(() => {});
}

process.once('SIGINT', () => {
  void stop();
});
process.once('SIGTERM', () => {
  void stop();
});

logger.info('Worker ready: probe + asset_validation + outbox scanner');
