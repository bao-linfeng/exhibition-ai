import type { FastifyPluginAsync, FastifyError } from 'fastify';
import fp from 'fastify-plugin';

const HTTP_CODE_NAMES: Record<number, string> = {
  400: 'BAD_REQUEST',
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  410: 'GONE',
  422: 'UNPROCESSABLE_ENTITY',
  429: 'TOO_MANY_REQUESTS',
  500: 'INTERNAL_SERVER_ERROR',
  503: 'SERVICE_UNAVAILABLE',
};

const errorHandler: FastifyPluginAsync = async (app) => {
  app.setErrorHandler((error: FastifyError, request, reply) => {
    const statusCode = error.statusCode ?? 500;
    const code =
      error.code === 'ACTIVE_RUN_EXISTS' || error.code === 'project_locked'
        ? error.code
        : (HTTP_CODE_NAMES[statusCode] ?? 'INTERNAL_SERVER_ERROR');
    const message =
      statusCode >= 500
        ? 'Internal server error'
        : error.message || 'An error occurred';

    const reason = (error as FastifyError & { reason?: string }).reason;
    void reply.code(statusCode).send({
      error: {
        code,
        message,
        requestId: request.id,
        ...(reason !== undefined ? { reason } : {}),
      },
    });
  });
};

export const errorHandlerPlugin = fp(errorHandler, { name: 'error-handler' });
