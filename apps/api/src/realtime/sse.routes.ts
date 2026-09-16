import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { Type } from '@sinclair/typebox';
import { UuidSchema } from '@exhibition/contracts';
import type { EventsService } from '@exhibition/backend';

interface ProjectEventRoutesDeps {
  eventsService: EventsService;
}

export async function realTimeRoutes(
  app: FastifyInstance,
  deps: ProjectEventRoutesDeps,
) {
  const { eventsService } = deps;

  app.get(
    '/api/v1/projects/:id/events',
    {
      schema: {
        operationId: 'subscribeProjectEvents',
        description: 'Subscribe to project SSE events.',
        tags: ['events'],
        params: Type.Object({ id: UuidSchema }),
        querystring: Type.Object(
          {
            after: Type.Optional(Type.Integer({ minimum: 0 })),
          },
          { additionalProperties: false },
        ),
        response: {
          200: {
            type: 'string',
            description: 'Server-Sent Events stream',
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id: projectId } = request.params as { id: string };
      const { after } = request.query as { after?: number };

      if (!request.actorContext) {
        return reply.unauthorized('Not authenticated');
      }

      if (!app.projectPolicy) {
        return reply.internalServerError('Project policy not initialized');
      }

      const hasAccess = await app.projectPolicy.canViewProject(
        request.actorContext,
        projectId,
      );

      if (!hasAccess) {
        return reply.notFound('Project not found');
      }

      reply.raw.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      });

      reply.raw.flushHeaders();

      const lastEventId = request.headers['last-event-id'];
      const afterSequence =
        typeof lastEventId === 'string'
          ? parseInt(lastEventId, 10)
          : after ?? 0;

      // 检查 cursor 是否过期（保留最近 10000 条事件）
      const minSequence = await eventsService.getMinSequence(projectId);
      const maxSequence = await eventsService.getMaxSequence(projectId);

      if (afterSequence > 0 && afterSequence < minSequence) {
        const resetEvent = {
          id: String(maxSequence),
          type: 'stream.reset',
          projectId,
          sequence: maxSequence,
          timestamp: new Date().toISOString(),
          data: {
            reason: 'cursor_too_old',
            minSequence: minSequence,
          },
        };

        reply.raw.write(
          `id: ${resetEvent.sequence}\nevent: ${resetEvent.type}\ndata: ${JSON.stringify(resetEvent)}\n\n`,
        );
        reply.raw.end();
        return;
      }

      const historicalEvents = await eventsService.getEvents(
        projectId,
        afterSequence,
      );

      for (const event of historicalEvents) {
        reply.raw.write(
          `id: ${event.sequence}\nevent: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`,
        );
      }

      let heartbeatInterval: NodeJS.Timeout | null = null;
      let authCheckInterval: NodeJS.Timeout | null = null;

      // 订阅实时事件（EventEmitter）
      const unsubscribe = eventsService.subscribe(projectId, (event) => {
        try {
          reply.raw.write(
            `id: ${event.sequence}\nevent: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`,
          );
        } catch (error) {
          app.log.error(error, 'Error writing SSE event');
        }
      });

      const cleanup = () => {
        if (heartbeatInterval) clearInterval(heartbeatInterval);
        if (authCheckInterval) clearInterval(authCheckInterval);
        unsubscribe();
      };

      // 心跳保持连接
      heartbeatInterval = setInterval(() => {
        try {
          reply.raw.write(': heartbeat\n\n');
        } catch (error) {
          cleanup();
        }
      }, 15000);

      // 定期复核权限
      authCheckInterval = setInterval(async () => {
        try {
          if (!request.actorContext || !app.projectPolicy) {
            reply.raw.end();
            cleanup();
            return;
          }

          const stillHasAccess = await app.projectPolicy.canViewProject(
            request.actorContext,
            projectId,
          );

          if (!stillHasAccess) {
            reply.raw.write(
              `event: connection.closed\ndata: {"reason":"access_revoked"}\n\n`,
            );
            reply.raw.end();
            cleanup();
          }
        } catch (error) {
          app.log.error(error, 'Error checking auth in SSE');
          reply.raw.end();
          cleanup();
        }
      }, 30000);

      request.raw.on('close', () => {
        cleanup();
      });
    },
  );
}
