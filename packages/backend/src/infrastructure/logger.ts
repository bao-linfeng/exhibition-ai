import pino from 'pino';

export type { Logger } from 'pino';

const SIGNED_URL_RE = /x-amz-signature/i;

function sanitizeValue(value: unknown, depth = 0): unknown {
  if (depth > 12) return '[MaxDepth]';
  if (typeof value === 'string') {
    if (SIGNED_URL_RE.test(value)) {
      const idx = value.indexOf('?');
      return idx >= 0 ? value.slice(0, idx) : '[REDACTED]';
    }
    return value;
  }
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value))
    return value.map((item) => sanitizeValue(item, depth + 1));
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    out[k] = sanitizeValue(v, depth + 1);
  }
  return out;
}

export const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  redact: {
    paths: [
      'password',
      'passwordHash',
      'password_hash',
      'cookie',
      'authorization',
      'token',
      'secret',
      'signature',
      '*.token',
      '*.secret',
      '*.signature',
      '*.password',
      '*.passwordHash',
      '*.password_hash',
      '*.cookie',
      '*.authorization',
      'accessKeyId',
      'secretAccessKey',
      'access_key',
      'secret_key',
      '*.accessKeyId',
      '*.secretAccessKey',
      '*.access_key',
      '*.secret_key',
      'req.headers.cookie',
      'req.headers.authorization',
      'req.headers.set-cookie',
    ],
    censor: '[REDACTED]',
  },
  serializers: {
    err: pino.stdSerializers.err,
    error: pino.stdSerializers.err,
    req(req) {
      const base = pino.stdSerializers.req(req);
      if (typeof base.url === 'string') {
        base.url = sanitizeValue(base.url) as string;
      }
      return base;
    },
    res: pino.stdSerializers.res,
    url: (value: unknown) => sanitizeValue(value),
    signedUrl: (value: unknown) => sanitizeValue(value),
  },
});

export function childLogger(module: string) {
  return logger.child({ module });
}
