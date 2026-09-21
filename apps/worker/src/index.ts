import { writeFile, unlink } from 'node:fs/promises';
import { S3Client } from '@aws-sdk/client-s3';
import {
  Worker,
  Queue,
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
  ModelConfigRepository,
  AuditService,
  createImageGenerationQueue,
  QUEUE_IMAGE_GENERATION,
  createBriefParseQueue,
  QUEUE_BRIEF_PARSE,
  createDesignDirectionQueue,
  QUEUE_DESIGN_DIRECTION,
  createAgentRunQueue,
  QUEUE_AGENT_RUN,
  ConversationRepository,
  MessageRepository,
  AgentRunRepository,
  ConfirmationRepository,
  EventsService,
  ExportRepository,
  createExportQueue,
  QUEUE_EXPORT,
  ProjectRepository,
  ProjectPolicy,
  GenerationService,
  ConversationService,
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
import {
  processAgentRun,
  type AgentRunJobData,
} from './processors/agent-run.processor.js';
import {
  processExport,
  type ExportJobData,
} from './processors/export.processor.js';
import { processPdfExport } from './processors/pdf-export.processor.js';
import { runConfirmationExpiry } from './schedulers/confirmation-expiry.js';
import { runTimeoutReconciler } from './schedulers/timeout-reconciler.js';
import { runStorageCleanup } from './schedulers/storage-cleanup.js';

const heartbeat = env.WORKER_HEALTH_FILE;
export const providers = bootstrapProviders();
const {
  imageProviderRegistry,
  textProviderRegistry,
  promptRegistry,
  defaultTextProviderId,
} = providers;

// DB + services
const { db, pool } = initDatabase();
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
const taskRepo = new TaskRepository(db, quotaRepo);
const generationRepo = new GenerationRepository(db, quotaRepo);
const auditService = new AuditService(db);
const quotaService = new QuotaService(db, quotaRepo, auditService);
const imageVersionRepo = new ImageVersionRepository(db);
const briefRepo = new BriefRepository(db);
const directionRepo = new DirectionRepository(db);
const projectRepo = new ProjectRepository(db);
const convRepo = new ConversationRepository(db);
const msgRepo = new MessageRepository(db);
const runRepo = new AgentRunRepository(db);
const confirmRepo = new ConfirmationRepository(db);
const exportRepo = new ExportRepository(db);
const eventsPubRedis = createQueueConnection();
const eventsSubRedis = createQueueConnection();
const eventsService = new EventsService(pool, eventsPubRedis, eventsSubRedis);
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
const agentRunQueue = createAgentRunQueue({ connection: workerConnection });
const exportQueue = createExportQueue({ connection: workerConnection });
const queues = new Map<string, Queue>([
  [QUEUE_ASSET_VALIDATION, assetValidationQueue],
  [QUEUE_IMAGE_GENERATION, imageGenerationQueue],
  [QUEUE_BRIEF_PARSE, briefParseQueue],
  [QUEUE_DESIGN_DIRECTION, designDirectionQueue],
  [QUEUE_AGENT_RUN, agentRunQueue],
  [QUEUE_EXPORT, exportQueue],
]);
const taskService = new TaskService(taskRepo, queues, quotaService);
const generationService = new GenerationService(
  generationRepo,
  new ProjectPolicy(pool),
  taskRepo,
  new ModelConfigRepository(db),
  queues,
  briefRepo,
  directionRepo,
  assetRepo,
  projectRepo,
  imageVersionRepo,
);
const conversationService = new ConversationService(
  db,
  convRepo,
  msgRepo,
  runRepo,
  confirmRepo,
  taskRepo,
  queues,
  eventsService,
  briefRepo,
  generationService,
  new ProjectPolicy(pool),
);

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
      briefRepo,
      directionRepo,
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
      projectRepo,
      eventsService,
      auditService,
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

const agentRunWorker = new Worker(
  QUEUE_AGENT_RUN,
  async (job) => {
    const data = job.data as AgentRunJobData;
    logger.info(
      { taskId: data.taskId, jobId: job.id },
      'Processing agent_run task',
    );
    await processAgentRun(data, {
      taskRepo,
      convRepo,
      msgRepo,
      runRepo,
      confirmRepo,
      briefRepo,
      assetRepo,
      imageVersionRepo,
      eventsService,
      textProvider: textProviderRegistry.resolve(defaultTextProviderId),
      textProviderId: defaultTextProviderId,
    });
  },
  { connection: createQueueConnection(), concurrency: 2 },
);
agentRunWorker.on('error', (err) => {
  logger.error({ err }, 'Agent run worker error');
});
agentRunWorker.on('failed', (job, err) => {
  logger.error({ jobId: job?.id, err }, 'Agent run job failed');
});

const exportWorker = new Worker(
  QUEUE_EXPORT,
  async (job) => {
    const data = job.data as ExportJobData;
    const exportRecord = await exportRepo.findById(data.exportId);
    const format = exportRecord?.format ?? 'zip';
    logger.info(
      { taskId: data.taskId, exportId: data.exportId, format, jobId: job.id },
      'Processing export task',
    );
    const deps = {
      taskRepo,
      exportRepo,
      imageVersionRepo,
      assetRepo,
      storage: s3,
      bucket,
    };
    if (format === 'pdf') {
      await processPdfExport(data, deps);
    } else {
      await processExport(data, deps);
    }
  },
  { connection: createQueueConnection(), concurrency: 2 },
);
exportWorker.on('error', (err) => {
  logger.error({ err }, 'Export worker error');
});
exportWorker.on('failed', (job, err) => {
  logger.error({ jobId: job?.id, err }, 'Export job failed');
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

let expiringConfirmations = false;
async function scanExpiredConfirmations() {
  if (expiringConfirmations || stopping) return;
  expiringConfirmations = true;
  try {
    await runConfirmationExpiry(conversationService);
  } finally {
    expiringConfirmations = false;
  }
}

let cleaningStorage = false;
async function cleanStorage() {
  if (cleaningStorage || stopping) return;
  cleaningStorage = true;
  try {
    await runStorageCleanup({ assetRepo, exportRepo, storage: s3, bucket });
  } catch (err) {
    logger.error({ err }, 'Storage cleanup error');
  } finally {
    cleaningStorage = false;
  }
}

await Promise.all([
  probeWorker.waitUntilReady(),
  assetValidationWorker.waitUntilReady(),
  imageGenerationWorker.waitUntilReady(),
  briefParseWorker.waitUntilReady(),
  designDirectionWorker.waitUntilReady(),
  agentRunWorker.waitUntilReady(),
  exportWorker.waitUntilReady(),
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
const confirmationExpiryTimer = setInterval(() => {
  void scanExpiredConfirmations();
}, 60_000);
const storageCleanupTimer = setInterval(
  () => {
    void cleanStorage();
  },
  60 * 60 * 1000, // 每小时执行一次
);

async function stop() {
  if (stopping) return;
  stopping = true;
  clearInterval(heartbeatTimer);
  clearInterval(outboxTimer);
  clearInterval(reconcilerTimer);
  clearInterval(confirmationExpiryTimer);
  clearInterval(storageCleanupTimer);
  await unlink(heartbeat).catch(() => {});
  await Promise.all([
    probeWorker.close(),
    assetValidationWorker.close(),
    imageGenerationWorker.close(),
    briefParseWorker.close(),
    designDirectionWorker.close(),
    agentRunWorker.close(),
    exportWorker.close(),
    assetValidationQueue.close(),
    imageGenerationQueue.close(),
    briefParseQueue.close(),
    designDirectionQueue.close(),
    agentRunQueue.close(),
    exportQueue.close(),
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
  'Worker ready: probe + asset_validation + brief_parse + design_direction + image_generation + agent_run + export + outbox scanner + timeout reconciler + confirmation expiry + storage cleanup',
);
