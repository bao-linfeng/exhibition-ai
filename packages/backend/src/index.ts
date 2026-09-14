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
import { createDatabase } from '@exhibition/db';
import { AuthService, AuthRepository } from './modules/auth/index.js';
import { CustomerService, CustomerRepository } from './modules/customers/index.js';
import { ProjectService, ProjectRepository } from './modules/projects/index.js';
import { UserService, UserRepository } from './modules/users/index.js';

export {
  AuthService, AuthRepository,
  CustomerService, CustomerRepository,
  ProjectService, ProjectRepository,
  UserService, UserRepository,
};

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

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}

export function redisConnection() {
  return {
    host: process.env.REDIS_HOST ?? 'localhost',
    port: Number(process.env.REDIS_PORT ?? '6379'),
    password: required('REDIS_PASSWORD'),
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
  pool: ReturnType<typeof createDatabase>['pool'];
  redis: RedisClientType;
  s3: S3Client;
  bucket: string;
  authService: AuthService;
  customerService: CustomerService;
  projectService: ProjectService;
  userService: UserService;
  connectRedis(): Promise<void>;
  readiness(): Promise<{ postgres: boolean; redis: boolean; storage: boolean }>;
  close(): Promise<void>;
}

export function createServices(): Services {
  const { pool, db: drizzleDb } = createDatabase();

  // 初始化认证服务
  const authRepository = new AuthRepository(drizzleDb);
  const authService = new AuthService(authRepository);
  const customerService = new CustomerService(new CustomerRepository(drizzleDb));
  const projectService = new ProjectService(new ProjectRepository(drizzleDb));
  const userService = new UserService(new UserRepository(drizzleDb));

  const connection = redisConnection();
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
  const bucket = required('S3_BUCKET');
  const s3 = new S3Client({
    endpoint: required('S3_ENDPOINT'),
    region: process.env.S3_REGION ?? 'us-east-1',
    forcePathStyle: true,
    credentials: {
      accessKeyId: required('S3_ACCESS_KEY'),
      secretAccessKey: required('S3_SECRET_KEY'),
    },
    maxAttempts: 1,
    requestHandler: { connectionTimeout: 5000, requestTimeout: 5000 },
  });
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
    s3.destroy();
    await pool.end();
  }
  return {
    pool, authService, customerService, projectService, userService,
    redis, s3, bucket, connectRedis, readiness, close,
  };
}
