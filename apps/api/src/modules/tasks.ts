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
import type {
  ListTasksQuery,
  ReconcileTaskRequest,
  RetryTaskRequest,
} from '@exhibition/contracts';

export async function taskRoutes(app: FastifyInstance) {
  async function currentUser(sessionId: string | undefined) {
    return sessionId
      ? app.services!.authService.validateSession(sessionId)
      : null;
  }

  function isMemberFn(user: { id: string; role: string }) {
    return async (projectId: string) => {
      const project = await app.services!.projectService.getProject(
        projectId,
        user,
      );
      return project !== null && project !== 'forbidden';
    };
  }

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
    async (request) => {
      const user = await currentUser(request.cookies.sessionId);
      if (!user) throw app.httpErrors.unauthorized('Not authenticated');

      const query = request.query as ListTasksQuery;
      const isAdmin = user.role === 'admin';

      const result = await app.services!.taskService.listTasks(
        {
          projectId: query.projectId,
          kind: query.kind,
          status: query.status,
          cursor: query.cursor,
          limit: query.limit,
        },
        user.id,
        isAdmin,
        isMemberFn(user),
      );

      if (result === 'forbidden') throw app.httpErrors.forbidden();
      return result;
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
    async (request) => {
      const user = await currentUser(request.cookies.sessionId);
      if (!user) throw app.httpErrors.unauthorized('Not authenticated');

      const { id } = request.params as { id: string };
      const isAdmin = user.role === 'admin';

      const result = await app.services!.taskService.getTask(
        id,
        user.id,
        isAdmin,
        isMemberFn(user),
      );

      if (result === 'not_found')
        throw app.httpErrors.notFound('Task not found');
      if (result === 'forbidden') throw app.httpErrors.forbidden();
      return { data: result };
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
    async (request) => {
      const user = await currentUser(request.cookies.sessionId);
      if (!user) throw app.httpErrors.unauthorized('Not authenticated');

      const { id } = request.params as { id: string };
      const isAdmin = user.role === 'admin';

      const result = await app.services!.taskService.cancelTask(
        id,
        user.id,
        isAdmin,
        isMemberFn(user),
      );

      if (result === 'not_found')
        throw app.httpErrors.notFound('Task not found');
      if (result === 'forbidden') throw app.httpErrors.forbidden();
      if (result === 'already_terminal') {
        throw app.httpErrors.conflict('Task is already in a terminal state');
      }
      if (result === 'not_cancellable') {
        throw app.httpErrors.unprocessableEntity('Task cannot be cancelled');
      }

      void app
        .services!.auditService.log({
          eventType: 'task.cancelled',
          actorId: user.id,
          actorEmail: user.email,
          resourceType: 'task',
          resourceId: id,
          metadata: {},
        })
        .catch(() => undefined);

      return {
        data: { status: 'cancelled' as const, message: 'Task cancelled' },
      };
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
    async (request, reply) => {
      const user = await currentUser(request.cookies.sessionId);
      if (!user) throw app.httpErrors.unauthorized('Not authenticated');

      const { id } = request.params as { id: string };
      const body = request.body as RetryTaskRequest;
      const result = await app.services!.taskService.retryTask(
        id,
        user.id,
        user.role === 'admin',
        isMemberFn(user),
        body,
      );

      if (result === 'not_found')
        throw app.httpErrors.notFound('Task not found');
      if (result === 'forbidden') throw app.httpErrors.forbidden();
      if (result === 'not_retryable') {
        throw app.httpErrors.unprocessableEntity(
          'Task cannot be retried: not_retryable',
        );
      }
      if (result === 'unsupported_kind') {
        throw app.httpErrors.unprocessableEntity(
          'Task cannot be retried: unsupported_kind',
        );
      }

      void app
        .services!.auditService.log({
          eventType: 'task.retried',
          actorId: user.id,
          actorEmail: user.email,
          resourceType: 'task',
          resourceId: id,
          metadata: { retryTaskId: result.id },
        })
        .catch(() => undefined);

      return reply.code(201).send({
        data: { taskId: result.id, status: 'pending' },
      });
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
    async (request) => {
      const user = await currentUser(request.cookies.sessionId);
      if (!user) throw app.httpErrors.unauthorized('Not authenticated');
      if (user.role !== 'admin') throw app.httpErrors.forbidden();

      const { id } = request.params as { id: string };
      const body = request.body as ReconcileTaskRequest;
      const result = await app.services!.taskService.reconcileTaskOutput(
        id,
        user.id,
        true,
        isMemberFn(user),
        body,
      );

      if (result === 'not_found')
        throw app.httpErrors.notFound('Task not found');
      if (result === 'forbidden') throw app.httpErrors.forbidden();
      if (result === 'not_reconciling') {
        throw app.httpErrors.conflict('Task is not reconciling');
      }
      if (result === 'ordinal_not_found') {
        throw app.httpErrors.unprocessableEntity(
          'Task output ordinal not found',
        );
      }

      void app
        .services!.auditService.log({
          eventType: 'task.reconciled',
          actorId: user.id,
          actorEmail: user.email,
          resourceType: 'task',
          resourceId: id,
          metadata: {
            ordinal: body.ordinal,
            outcome: body.outcome,
            reason: body.reason,
          },
        })
        .catch(() => undefined);

      return { data: result };
    },
  );
}
