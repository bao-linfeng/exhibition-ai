export type AppEnv = 'development' | 'production' | 'test';

export interface Environment {
  APP_ENV: AppEnv;
  LOG_LEVEL: string;
  DATABASE_URL: string;
  REDIS_HOST: string;
  REDIS_PORT: number;
  REDIS_PASSWORD: string;
  S3_ENDPOINT: string;
  S3_PUBLIC_ENDPOINT?: string;
  S3_ACCESS_KEY: string;
  S3_SECRET_KEY: string;
  S3_BUCKET: string;
  S3_REGION: string;
  COOKIE_SECRET: string;
  HOST: string;
  PORT: number;
  WORKER_HEALTH_FILE: string;
  SMTP_HOST?: string;
  SMTP_PORT?: number;
  SMTP_USER?: string;
  SMTP_PASS?: string;
  SMTP_FROM?: string;
}

function optional(name: string): string | undefined {
  const value = process.env[name];
  if (value === undefined || value.trim().length === 0) return undefined;
  return value;
}

function parsePort(name: string, defaultValue?: number): number | undefined {
  const value = optional(name);
  if (value === undefined) return defaultValue;

  const port = Number(value);
  return Number.isInteger(port) && port >= 1 && port <= 65535
    ? port
    : undefined;
}

function parseEnv(): Environment {
  const appEnvValue =
    process.env.APP_ENV ?? process.env.NODE_ENV ?? 'development';
  const missing: string[] = [];
  const invalid: string[] = [];
  const validLogLevels = ['trace', 'debug', 'info', 'warn', 'error', 'fatal'];
  const logLevelValue = process.env.LOG_LEVEL ?? 'info';
  const isAppEnv = (value: string): value is AppEnv =>
    value === 'development' || value === 'production' || value === 'test';

  if (!isAppEnv(appEnvValue)) invalid.push('APP_ENV');
  if (!validLogLevels.includes(logLevelValue)) {
    invalid.push(
      `LOG_LEVEL (got "${logLevelValue}", expected one of: ${validLogLevels.join(', ')})`,
    );
  }
  const appEnv: AppEnv = isAppEnv(appEnvValue) ? appEnvValue : 'development';
  const requiredNames =
    appEnv === 'production'
      ? [
          'DATABASE_URL',
          'REDIS_PASSWORD',
          'S3_ENDPOINT',
          'S3_ACCESS_KEY',
          'S3_SECRET_KEY',
          'S3_BUCKET',
          'COOKIE_SECRET',
        ]
      : ['DATABASE_URL'];

  for (const name of requiredNames) {
    if (optional(name) === undefined) missing.push(name);
  }

  const redisPort = parsePort('REDIS_PORT', 6379);
  const port = parsePort('PORT', 3000);
  const smtpPort = parsePort('SMTP_PORT');
  if (redisPort === undefined) invalid.push('REDIS_PORT');
  if (port === undefined) invalid.push('PORT');
  if (optional('SMTP_PORT') !== undefined && smtpPort === undefined) {
    invalid.push('SMTP_PORT');
  }
  if (
    appEnv === 'production' &&
    optional('COOKIE_SECRET') !== undefined &&
    (process.env.COOKIE_SECRET?.length ?? 0) < 32
  ) {
    invalid.push(
      'COOKIE_SECRET (must be at least 32 characters in production)',
    );
  }

  if (missing.length > 0 || invalid.length > 0) {
    if (missing.length > 0) {
      console.error(
        `[config] Missing required environment variables: ${missing.join(', ')}`,
      );
    }
    if (invalid.length > 0) {
      console.error(
        `[config] Invalid environment variables: ${invalid.join(', ')}`,
      );
    }
    process.exit(1);
  }

  return {
    APP_ENV: appEnv,
    LOG_LEVEL: validLogLevels.includes(logLevelValue) ? logLevelValue : 'info',
    DATABASE_URL: process.env.DATABASE_URL as string,
    REDIS_HOST: process.env.REDIS_HOST ?? 'localhost',
    REDIS_PORT: redisPort as number,
    REDIS_PASSWORD: process.env.REDIS_PASSWORD ?? '',
    S3_ENDPOINT: process.env.S3_ENDPOINT ?? 'http://localhost:9000',
    S3_PUBLIC_ENDPOINT: optional('S3_PUBLIC_ENDPOINT'),
    S3_ACCESS_KEY: process.env.S3_ACCESS_KEY ?? '',
    S3_SECRET_KEY: process.env.S3_SECRET_KEY ?? '',
    S3_BUCKET: process.env.S3_BUCKET ?? 'exhibition-dev',
    S3_REGION: process.env.S3_REGION ?? 'us-east-1',
    COOKIE_SECRET:
      process.env.COOKIE_SECRET ??
      'development-cookie-secret-change-before-production',
    HOST: process.env.HOST ?? '0.0.0.0',
    PORT: port as number,
    WORKER_HEALTH_FILE:
      process.env.WORKER_HEALTH_FILE ?? '/tmp/exhibition-worker-health',
    SMTP_HOST: optional('SMTP_HOST'),
    SMTP_PORT: smtpPort,
    SMTP_USER: optional('SMTP_USER'),
    SMTP_PASS: optional('SMTP_PASS'),
    SMTP_FROM: optional('SMTP_FROM'),
  };
}

export const env = parseEnv();
