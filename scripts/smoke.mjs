import { randomUUID } from 'node:crypto';
import {
  createServices,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  Queue,
  QueueEvents,
  createQueueConnection,
  probeQueue,
} from '../packages/backend/src/index.ts';

const services = createServices();
const nonce = randomUUID();
const key = `_smoke/${nonce}.txt`;
const redisKey = `exhibition:smoke:${nonce}`;
const queueConnection = createQueueConnection();
const eventConnection = createQueueConnection();
const queue = new Queue(probeQueue, { connection: queueConnection });
const events = new QueueEvents(probeQueue, { connection: eventConnection });
queue.on('error', () => {});
events.on('error', () => {});
let job;
let objectCreated = false;
let stage = 'dependency readiness';
const deadline = setTimeout(() => {
  console.error('Smoke timed out.');
  process.exit(1);
}, 60000);
try {
  const readiness = await services.readiness();
  if (!Object.values(readiness).every(Boolean))
    throw new Error('Dependencies are not ready');
  stage = 'PostgreSQL vector extension';
  const extension = await services.pool.query(
    "SELECT 1 FROM pg_extension WHERE extname = 'vector'",
  );
  if (extension.rowCount !== 1) throw new Error('Vector extension missing');
  stage = 'Redis write/read';
  await services.redis.set(redisKey, nonce, { EX: 60 });
  if ((await services.redis.get(redisKey)) !== nonce)
    throw new Error('Redis roundtrip failed');
  stage = 'S3 write/read';
  await services.s3.send(
    new PutObjectCommand({
      Bucket: services.bucket,
      Key: key,
      Body: nonce,
      ContentType: 'text/plain',
    }),
  );
  objectCreated = true;
  const object = await services.s3.send(
    new GetObjectCommand({ Bucket: services.bucket, Key: key }),
  );
  if ((await object.Body?.transformToString()) !== nonce)
    throw new Error('Storage roundtrip failed');
  stage = 'worker roundtrip';
  await events.waitUntilReady();
  job = await queue.add(
    'smoke',
    { nonce },
    {
      jobId: nonce,
      removeOnComplete: { age: 3600 },
      removeOnFail: { age: 3600 },
    },
  );
  const result = await job.waitUntilFinished(events, 15000);
  if (result?.nonce !== nonce || result?.status !== 'ok')
    throw new Error('Worker roundtrip failed');
  stage = 'API health/readiness';
  const apiUrl = process.env.API_INTERNAL_URL ?? 'http://api:3000';
  for (const path of ['/api/health', '/api/ready']) {
    const response = await fetch(new URL(path, apiUrl), {
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw new Error('API probe failed');
    const body = await response.json();
    if (body.status !== (path.endsWith('ready') ? 'ready' : 'ok'))
      throw new Error('API response invalid');
  }
  console.log(
    'Smoke passed: PostgreSQL/vector, Redis, S3 write/read, worker roundtrip and API health/readiness.',
  );
} catch {
  console.error(
    `Smoke failed at ${stage}; check the corresponding local service.`,
  );
  process.exitCode = 1;
} finally {
  if (job) await job.remove().catch(() => {});
  if (objectCreated)
    await services.s3
      .send(new DeleteObjectCommand({ Bucket: services.bucket, Key: key }))
      .catch(() => {
        process.exitCode = 1;
      });
  if (services.redis.isReady)
    await services.redis.del(redisKey).catch(() => {
      process.exitCode = 1;
    });
  await Promise.allSettled([queue.close(), events.close(), services.close()]);
  queueConnection.disconnect();
  eventConnection.disconnect();
  clearTimeout(deadline);
}
