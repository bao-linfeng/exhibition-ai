import type { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import {
  ListTasksQuerySchema,
  ListTasksResponseSchema,
  GetTaskResponseSchema,
  CancelTaskResponseSchema,
  RetryTaskRequestSchema,
  RetryTaskResponseSchema,
  ReconcileTaskRequestSchema,
  ReconcileTaskResponseSchema,
  UuidSchema,
} from '@exhibition/contracts';

export async function taskRoutes(app: FastifyInstance) {
  // GET /api/v1/tasks
  app.get(
    '/api/v1/tasks',
    {
      schema: {
        operationId: 'listTasks',
        description: 'List tasks with filtering.',
        tags: ['tasks'],
        querystring: ListTasksQuerySchema,
        response: {
          200: ListTasksResponseSchema,
        },
      },
    },
    async () => {
      throw app.httpErrors.notImplemented('List tasks not implemented');
    },
  );

  // GET /api/v1/tasks/:id
  app.get(
    '/api/v1/tasks/:id',
    {
      schema: {
        operationId: 'getTask',
        description: 'Get task details.',
        tags: ['tasks'],
        params: Type.Object({ id: UuidSchema }),
        response: {
          200: GetTaskResponseSchema,
        },
      },
    },
    async () => {
      throw app.httpErrors.notImplemented('Get task not implemented');
    },
  );

  // POST /api/v1/tasks/:id/cancel
  app.post(
    '/api/v1/tasks/:id/cancel',
    {
      schema: {
        operationId: 'cancelTask',
        description: 'Cancel task.',
        tags: ['tasks'],
        params: Type.Object({ id: UuidSchema }),
        response: {
          200: CancelTaskResponseSchema,
        },
      },
    },
    async () => {
      throw app.httpErrors.notImplemented('Cancel task not implemented');
    },
  );

  // POST /api/v1/tasks/:id/retry
  app.post(
    '/api/v1/tasks/:id/retry',
    {
      schema: {
        operationId: 'retryTask',
        description: 'Retry failed task outputs.',
        tags: ['tasks'],
        params: Type.Object({ id: UuidSchema }),
        body: RetryTaskRequestSchema,
        response: {
          201: RetryTaskResponseSchema,
        },
      },
    },
    async () => {
      throw app.httpErrors.notImplemented('Retry task not implemented');
    },
  );

  // POST /api/v1/tasks/:id/reconcile
  app.post(
    '/api/v1/tasks/:id/reconcile',
    {
      schema: {
        operationId: 'reconcileTask',
        description: 'Reconcile task output (admin only).',
        tags: ['tasks'],
        params: Type.Object({ id: UuidSchema }),
        body: ReconcileTaskRequestSchema,
        response: {
          200: ReconcileTaskResponseSchema,
        },
      },
    },
    async () => {
      throw app.httpErrors.notImplemented('Reconcile task not implemented');
    },
  );
}
