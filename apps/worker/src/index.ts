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
  GenerationRepository,
  ImageVersionRepository,
  BriefRepository,
  DirectionRepository,
  QuotaRepository,
  QuotaService,
  AuditService,
  createImageGenerationQueue,
  QUEUE_IMAGE_GENERATION,
  createBriefParseQueue,
  QUEUE_BRIEF_PARSE,
  createDesignDirectionQueue,
  QUEUE_DESIGN_DIRECTION,
} from '@exhibition/backend';
import { bootstrapProviders } from './bootstrap.js';
import { processAssetValidation } from './processors/asset-validation.processor.js';
import {
  processImageGeneration,
  type ImageGenerationJobData,
} from './processors/image-generation.processor.js';
import {
  processBriefParse,
  type BriefParseJobData,
} from './processors/brief-parse.processor.js';
import {
  processDesignDirection,
  type DesignDirectionJobData,
} from './processors/design-direction.processor.js';
import { runTimeoutReconciler } from './schedulers/timeout-reconciler.js';

const heartbeat = env.WORKER_HEALTH_FILE;
export const providers = bootstrapProviders();
const {
  imageProviderRegistry,
  textProviderRegistry,
  promptRegistry,
  defaultTextProviderId,
} = providers;

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
const quotaRepo = new QuotaRepository(db);
const generationRepo = new GenerationRepository(db, quotaRepo);
const quotaService = new QuotaService(db, quotaRepo, new AuditService(db));
const imageVersionRepo = new ImageVersionRepository(db);
const briefRepo = new BriefRepository(db);
const directionRepo = new DirectionRepository(db);
const bucket = env.S3_BUCKET;

// Redis connections
const probeConnection = createQueueConnection();
const workerConnection = createQueueConnection();
const scannerConnection = createQueueConnection();

// Queues (for outbox relay)
const assetValidationQueue = createAssetValidationQueue({
  connection: workerConnection,
});
const imageGenerationQueue = createImageGenerationQueue({
  connection: workerConnection,
});
const briefParseQueue = createBriefParseQueue({ connection: workerConnection });
const designDirectionQueue = createDesignDirectionQueue({
  connection: workerConnection,
});
const queues = new Map([
  [QUEUE_ASSET_VALIDATION, assetValidationQueue],
  [QUEUE_IMAGE_GENERATION, imageGenerationQueue],
  [QUEUE_BRIEF_PARSE, briefParseQueue],
  [QUEUE_DESIGN_DIRECTION, designDirectionQueue],
]);
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

// Image generation worker
const imageGenerationWorker = new Worker(
  QUEUE_IMAGE_GENERATION,
  async (job) => {
    const data = job.data as ImageGenerationJobData;
    logger.info(
      { taskId: data.taskId, jobId: job.id },
      'Processing image_generation task',
    );
    await processImageGeneration(data, {
      taskRepo,
      generationRepo,
      assetRepo,
      imageVersionRepo,
      quotaService,
      storage: s3,
      bucket,
      imageProviderRegistry,
      promptRegistry,
    });
  },
  { connection: createQueueConnection(), concurrency: 4 },
);
imageGenerationWorker.on('error', (err) => {
  logger.error({ err }, 'Image generation worker error');
});
imageGenerationWorker.on('failed', (job, err) => {
  logger.error({ jobId: job?.id, err }, 'Image generation job failed');
});

const briefParseWorker = new Worker(
  QUEUE_BRIEF_PARSE,
  async (job) => {
    const data = job.data as BriefParseJobData;
    logger.info(
      { taskId: data.taskId, jobId: job.id },
      'Processing brief_parse task',
    );
    await processBriefParse(data, {
      taskRepo,
      textProviderRegistry,
      textProviderId: defaultTextProviderId,
      promptRegistry,
    });
  },
  { connection: createQueueConnection(), concurrency: 2 },
);
briefParseWorker.on('error', (err) => {
  logger.error({ err }, 'Brief parse worker error');
});
briefParseWorker.on('failed', (job, err) => {
  logger.error({ jobId: job?.id, err }, 'Brief parse job failed');
});

const designDirectionWorker = new Worker(
  QUEUE_DESIGN_DIRECTION,
  async (job) => {
    const data = job.data as DesignDirectionJobData;
    logger.info(
      { taskId: data.taskId, jobId: job.id },
      'Processing design_direction task',
    );
    await processDesignDirection(data, {
      taskRepo,
      briefRepo,
      directionRepo,
      textProviderRegistry,
      textProviderId: defaultTextProviderId,
      promptRegistry,
    });
  },
  { connection: createQueueConnection(), concurrency: 2 },
);
designDirectionWorker.on('error', (err) => {
  logger.error({ err }, 'Design direction worker error');
});
designDirectionWorker.on('failed', (job, err) => {
  logger.error({ jobId: job?.id, err }, 'Design direction job failed');
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

let reconciling = false;
async function scanStuckTasks() {
  if (reconciling || stopping) return;
  reconciling = true;
  try {
    await runTimeoutReconciler(taskService);
  } finally {
    reconciling = false;
  }
}

await Promise.all([
  probeWorker.waitUntilReady(),
  assetValidationWorker.waitUntilReady(),
  imageGenerationWorker.waitUntilReady(),
  briefParseWorker.waitUntilReady(),
  designDirectionWorker.waitUntilReady(),
]);
await pulse();

const heartbeatTimer = setInterval(() => {
  void pulse();
}, 10_000);
const outboxTimer = setInterval(() => {
  void scanOutbox();
}, 60_000);
const reconcilerTimer = setInterval(
  () => {
    void scanStuckTasks();
  },
  5 * 60 * 1000,
);

async function stop() {
  if (stopping) return;
  stopping = true;
  clearInterval(heartbeatTimer);
  clearInterval(outboxTimer);
  clearInterval(reconcilerTimer);
  await unlink(heartbeat).catch(() => {});
  await Promise.all([
    probeWorker.close(),
    assetValidationWorker.close(),
    imageGenerationWorker.close(),
    briefParseWorker.close(),
    designDirectionWorker.close(),
    assetValidationQueue.close(),
    imageGenerationQueue.close(),
    briefParseQueue.close(),
    designDirectionQueue.close(),
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

logger.info(
  'Worker ready: probe + asset_validation + brief_parse + design_direction + image_generation + outbox scanner + timeout reconciler',
);
