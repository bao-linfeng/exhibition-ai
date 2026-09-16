import {
  S3Client,
  HeadBucketCommand,
  CreateBucketCommand,
  PutBucketCorsCommand,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { createClient, type RedisClientType } from 'redis';
import { Redis } from 'ioredis';
import { env, initDatabase, closeDatabase } from './infrastructure/index.js';
import { AuthService, AuthRepository } from './modules/auth/index.js';
import { MailService } from './modules/mail/mail.service.js';
import { VerificationService } from './modules/verification/verification.service.js';
import {
  CustomerService,
  CustomerRepository,
} from './modules/customers/index.js';
import { ProjectService, ProjectRepository } from './modules/projects/index.js';
import { BriefService, BriefRepository } from './modules/briefs/index.js';
import {
  BriefParseService,
  BriefParseRepository,
} from './modules/brief-parse/index.js';
import {
  DirectionService,
  DirectionRepository,
} from './modules/directions/index.js';
import { UserService, UserRepository } from './modules/users/index.js';
import { DashboardService } from './modules/dashboard/index.js';
import { AuditService } from './modules/audit/index.js';
import {
  ModelConfigRepository,
  QuotaRepository,
  SettingsService,
  QuotaService,
} from './modules/settings/index.js';
import { TaskService, TaskRepository } from './modules/tasks/index.js';
import { AssetService, AssetRepository } from './modules/assets/index.js';
import {
  GenerationService,
  GenerationRepository,
} from './modules/generations/index.js';
import {
  ImageVersionService,
  ImageVersionRepository,
} from './modules/image-versions/index.js';
import { EventsService } from './modules/events/index.js';
import {
  ConversationService,
  ConversationRepository,
  MessageRepository,
  AgentRunRepository,
  ConfirmationRepository,
} from './modules/conversations/index.js';
import { S3StorageProvider } from './infrastructure/storage.js';
import {
  createAssetValidationQueue,
  QUEUE_ASSET_VALIDATION,
  createImageGenerationQueue,
  QUEUE_IMAGE_GENERATION,
  createBriefParseQueue,
  QUEUE_BRIEF_PARSE,
  createDesignDirectionQueue,
  QUEUE_DESIGN_DIRECTION,
  createAgentRunQueue,
  QUEUE_AGENT_RUN,
} from './infrastructure/queue.js';

export {
  AuthService,
  AuthRepository,
  CustomerService,
  CustomerRepository,
  ProjectService,
  ProjectRepository,
  BriefService,
  BriefRepository,
  BriefParseService,
  BriefParseRepository,
  DirectionService,
  DirectionRepository,
  UserService,
  UserRepository,
  DashboardService,
  AuditService,
  TaskService,
  TaskRepository,
  AssetService,
  AssetRepository,
  GenerationService,
  GenerationRepository,
  ImageVersionService,
  ImageVersionRepository,
  EventsService,
};
export {
  ConversationService,
  ConversationRepository,
  MessageRepository,
  AgentRunRepository,
  ConfirmationRepository,
} from './modules/conversations/index.js';
export type { ActorContext } from './shared/ActorContext.js';
export { ProjectPolicy } from './modules/projects/project.policy.js';
export {
  ModelConfigRepository,
  QuotaRepository,
  SettingsService,
  QuotaService,
} from './modules/settings/index.js';
export type { ReserveResult, SettleInput } from './modules/settings/index.js';
export { S3StorageProvider } from './infrastructure/storage.js';
export type { StorageProvider } from './infrastructure/storage.js';
export type {
  ImageGenerationResultPort,
  ImageOutputPort,
  ImageProviderPort,
  PromptSnapshotPort,
  TextGenerationResultPort,
  TextProviderPort,
} from './ports/ai.js';

export {
  env,
  logger,
  childLogger,
  initDatabase,
} from './infrastructure/index.js';
export {
  createAssetValidationQueue,
  QUEUE_ASSET_VALIDATION,
  createImageGenerationQueue,
  QUEUE_IMAGE_GENERATION,
  createBriefParseQueue,
  QUEUE_BRIEF_PARSE,
  createDesignDirectionQueue,
  QUEUE_DESIGN_DIRECTION,
} from './infrastructure/queue.js';
export {
  QUEUE_AGENT_RUN,
  createAgentRunQueue,
} from './infrastructure/queue.js';

export {
  HeadBucketCommand,
  CreateBucketCommand,
  PutBucketCorsCommand,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
};
export { Queue, QueueEvents, Worker } from 'bullmq';
export const probeQueue = 'exhibition-local-probe';

export function redisConnection() {
  return {
    host: env.REDIS_HOST,
    port: env.REDIS_PORT,
    password: env.REDIS_PASSWORD,
    connectTimeout: 5000,
    maxRetriesPerRequest: null,
  };
}

export function createQueueConnection(): Redis {
  const client = new Redis(redisConnection());
  client.on('error', () => {
    /* Queue and worker report sanitized connection failures. */
  });
  return client;
}

export interface Services {
  pool: ReturnType<typeof initDatabase>['pool'];
  redis: RedisClientType;
  s3: S3Client;
  bucket: string;
  authService: AuthService;
  customerService: CustomerService;
  projectService: ProjectService;
  briefService: BriefService;
  briefParseService: BriefParseService;
  directionService: DirectionService;
  userService: UserService;
  dashboardService: DashboardService;
  auditService: AuditService;
  taskService: TaskService;
  assetService: AssetService;
  generationService: GenerationService;
  settingsService: SettingsService;
  quotaService: QuotaService;
  imageVersionService: ImageVersionService;
  conversationService: ConversationService;
  eventsService: EventsService;
  connectRedis(): Promise<void>;
  readiness(): Promise<{ postgres: boolean; redis: boolean; storage: boolean }>;
  close(): Promise<void>;
}

export function createServices(): Services {
  const { pool, db: drizzleDb } = initDatabase();

  // 初始化认证服务
  const authRepository = new AuthRepository(drizzleDb);
  const customerService = new CustomerService(
    new CustomerRepository(drizzleDb),
  );
  const userService = new UserService(new UserRepository(drizzleDb));
  const dashboardService = new DashboardService(drizzleDb);
  const auditService = new AuditService(drizzleDb);
  const modelConfigRepo = new ModelConfigRepository(drizzleDb);
  const quotaRepo = new QuotaRepository(drizzleDb);
  const settingsService = new SettingsService(modelConfigRepo);
  const quotaService = new QuotaService(drizzleDb, quotaRepo, auditService);

  // EventsService 需要在 ProjectService 和 BriefService 之前初始化
  const eventsService = new EventsService(pool);
  const projectService = new ProjectService(
    new ProjectRepository(drizzleDb),
    eventsService,
  );
  const briefService = new BriefService(
    new BriefRepository(drizzleDb),
    eventsService,
  );

  const connection = redisConnection();
  const queueConnection = createQueueConnection();
  const assetValidationQueue = createAssetValidationQueue({
    connection: queueConnection,
  });
  const queues = new Map<string, import('bullmq').Queue>();
  queues.set(
    QUEUE_ASSET_VALIDATION,
    assetValidationQueue as import('bullmq').Queue,
  );
  const imageGenerationQueue = createImageGenerationQueue({
    connection: queueConnection,
  });
  queues.set(
    QUEUE_IMAGE_GENERATION,
    imageGenerationQueue as import('bullmq').Queue,
  );
  const briefParseQueue = createBriefParseQueue({
    connection: queueConnection,
  });
  queues.set(QUEUE_BRIEF_PARSE, briefParseQueue as import('bullmq').Queue);
  const designDirectionQueue = createDesignDirectionQueue({
    connection: queueConnection,
  });
  queues.set(
    QUEUE_DESIGN_DIRECTION,
    designDirectionQueue as import('bullmq').Queue,
  );
  const agentRunQueue = createAgentRunQueue({ connection: queueConnection });
  queues.set(QUEUE_AGENT_RUN, agentRunQueue as import('bullmq').Queue);
  const taskRepo = new TaskRepository(drizzleDb);
  const taskService = new TaskService(taskRepo, queues);
  const briefParseService = new BriefParseService(
    new BriefParseRepository(drizzleDb),
    taskRepo,
    queues,
  );
  const directionService = new DirectionService(
    new DirectionRepository(drizzleDb),
    taskRepo,
    queues,
  );
  const generationService = new GenerationService(
    new GenerationRepository(drizzleDb, quotaRepo),
    taskRepo,
    modelConfigRepo,
    queues,
  );
  const imageVersionService = new ImageVersionService(
    new ImageVersionRepository(drizzleDb),
  );
  const convRepo = new ConversationRepository(drizzleDb);
  const msgRepo = new MessageRepository(drizzleDb);
  const agentRunRepo = new AgentRunRepository(drizzleDb);
  const confirmRepo = new ConfirmationRepository(drizzleDb);
  const conversationService = new ConversationService(
    convRepo,
    msgRepo,
    agentRunRepo,
    confirmRepo,
    taskRepo,
    queues,
    eventsService,
    new BriefRepository(drizzleDb),
    generationService,
  );
  const verificationRedis = new Redis(connection);
  verificationRedis.on('error', () => undefined);
  const authService = new AuthService(
    authRepository,
    new VerificationService(verificationRedis),
    new MailService(),
  );
  const redis = createClient({
    socket: {
      host: connection.host,
      port: connection.port,
      connectTimeout: 5000,
      reconnectStrategy: false,
    },
    password: connection.password,
  });
  redis.on('error', () => {
    /* Readiness reports dependency failure without connection details. */
  });
  const bucket = env.S3_BUCKET;
  const s3 = new S3Client({
    endpoint: env.S3_ENDPOINT,
    region: env.S3_REGION,
    forcePathStyle: true,
    credentials: {
      accessKeyId: env.S3_ACCESS_KEY,
      secretAccessKey: env.S3_SECRET_KEY,
    },
    maxAttempts: 1,
    requestHandler: { connectionTimeout: 5000, requestTimeout: 5000 },
  });
  const storageProvider = new S3StorageProvider(
    s3,
    env.S3_PUBLIC_ENDPOINT,
    env.S3_REGION,
  );
  const assetService = new AssetService(
    new AssetRepository(drizzleDb),
    storageProvider,
    bucket,
    taskService,
  );
  let connecting: Promise<unknown> | undefined;
  async function connectRedis() {
    if (redis.isReady) return;
    connecting ??= redis.connect().finally(() => {
      connecting = undefined;
    });
    await connecting;
  }
  async function readiness() {
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const ping = Promise.race([
      connectRedis().then(() => redis.ping()),
      new Promise<never>((_resolve, reject) => {
        timeout = setTimeout(
          () => reject(new Error('Redis readiness timed out')),
          5000,
        );
      }),
    ]).finally(() => {
      clearTimeout(timeout);
    });
    const results = await Promise.allSettled([
      pool.query('SELECT 1'),
      ping,
      s3.send(new HeadBucketCommand({ Bucket: bucket })),
    ]);
    return {
      postgres: results[0]?.status === 'fulfilled',
      redis: results[1]?.status === 'fulfilled',
      storage: results[2]?.status === 'fulfilled',
    };
  }
  async function close() {
    if (redis.isOpen) redis.destroy();
    verificationRedis.disconnect();
    s3.destroy();
    await assetValidationQueue.close();
    await imageGenerationQueue.close();
    await briefParseQueue.close();
    await designDirectionQueue.close();
    await agentRunQueue.close();
    queueConnection.disconnect();
    await closeDatabase();
  }
  return {
    pool,
    authService,
    customerService,
    projectService,
    briefService,
    briefParseService,
    directionService,
    userService,
    dashboardService,
    auditService,
    taskService,
    assetService,
    generationService,
    settingsService,
    quotaService,
    imageVersionService,
    conversationService,
    eventsService,
    redis,
    s3,
    bucket,
    connectRedis,
    readiness,
    close,
  };
}
