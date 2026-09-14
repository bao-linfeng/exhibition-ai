import type { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { UuidSchema } from '@exhibition/contracts';

export async function eventRoutes(app: FastifyInstance) {
  // GET /api/v1/projects/:projectId/events
  app.get(
    '/api/v1/projects/:projectId/events',
    {
      schema: {
        operationId: 'subscribeProjectEvents',
        description: 'Subscribe to project SSE events.',
        tags: ['events'],
        params: Type.Object({ id: UuidSchema }),
        querystring: Type.Object(
          {
            after: Type.Optional(Type.Integer({ minimum: 1 })),
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
    async () => {
      throw app.httpErrors.notImplemented(
        'Project events subscription not implemented',
      );
    },
  );
}
