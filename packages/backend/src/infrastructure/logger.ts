import pino from 'pino';

export type { Logger } from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  redact: {
    paths: [
      'password',
      'passwordHash',
      'password_hash',
      'cookie',
      'authorization',
      '*.token',
      '*.secret',
      '*.signature',
      'accessKeyId',
      'secretAccessKey',
      'access_key',
      'secret_key',
      'req.headers.cookie',
      'req.headers.authorization',
    ],
    censor: '[REDACTED]',
  },
  serializers: {
    err: pino.stdSerializers.err,
    error: pino.stdSerializers.err,
    req: pino.stdSerializers.req,
    res: pino.stdSerializers.res,
  },
});

export function childLogger(module: string) {
  return logger.child({ module });
}
