import type { FastifyInstance } from 'fastify';
import { ListModelConfigsResponseSchema } from '@exhibition/contracts';

export async function modelRoutes(app: FastifyInstance) {
  // GET /api/v1/models
  app.get(
    '/api/v1/models',
    {
      schema: {
        operationId: 'listModelConfigs',
        description: 'List available AI models.',
        tags: ['models'],
        response: {
          200: ListModelConfigsResponseSchema,
        },
      },
    },
    async () => {
      throw app.httpErrors.notImplemented('List models not implemented');
    },
  );
}
