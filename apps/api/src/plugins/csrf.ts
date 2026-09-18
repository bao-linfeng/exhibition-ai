import { createHmac, timingSafeEqual } from 'node:crypto';
import type { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import { env } from '@exhibition/backend';

/** 根据 sessionId 派生 CSRF token（无状态，不需要额外存储） */
export function deriveCsrfToken(sessionId: string): string {
  return createHmac('sha256', env.COOKIE_SECRET)
    .update(sessionId)
    .digest('hex');
}

/** 校验 CSRF token（恒定时间比较防止时序攻击） */
function verifyCsrfToken(sessionId: string, token: string): boolean {
  const expected = deriveCsrfToken(sessionId);
  try {
    return timingSafeEqual(
      Buffer.from(expected, 'hex'),
      Buffer.from(token, 'hex'),
    );
  } catch {
    return false;
  }
}

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/** 跳过 CSRF 校验的路由（无 session 的公开接口） */
const CSRF_EXEMPT_PATHS = new Set([
  '/api/v1/auth/login',
  '/api/v1/auth/forgot-password',
  '/api/v1/auth/csrf',
  '/api/health',
  '/api/ready',
]);

export const csrfPlugin: FastifyPluginAsync = fp(async (app) => {
  app.addHook('preHandler', async (request, reply) => {
    if (SAFE_METHODS.has(request.method)) return;

    if (CSRF_EXEMPT_PATHS.has(request.routeOptions?.url ?? request.url)) return;

    const sessionId = request.cookies.sessionId;
    if (!sessionId) return;

    const token = request.headers['x-csrf-token'];
    if (typeof token !== 'string' || !verifyCsrfToken(sessionId, token)) {
      return reply.code(403).send({
        error: 'Forbidden',
        message: 'Invalid or missing CSRF token',
      });
    }
  });
});
