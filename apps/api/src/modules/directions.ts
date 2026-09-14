import type { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import {
  ListDesignDirectionsQuerySchema,
  ListDesignDirectionsResponseSchema,
  GetDesignDirectionResponseSchema,
  UuidSchema,
} from '@exhibition/contracts';

export async function directionRoutes(app: FastifyInstance) {
  // GET /api/v1/projects/:projectId/directions
  app.get(
    '/api/v1/projects/:projectId/directions',
    {
      schema: {
        operationId: 'listDesignDirections',
        description: 'List design directions.',
        tags: ['directions'],
        params: Type.Object({ projectId: UuidSchema }),
        querystring: ListDesignDirectionsQuerySchema,
        response: {
          200: ListDesignDirectionsResponseSchema,
        },
      },
    },
    async () => {
      throw app.httpErrors.notImplemented('List directions not implemented');
    },
  );

  // GET /api/v1/projects/:projectId/directions/:directionId
  app.get(
    '/api/v1/projects/:projectId/directions/:directionId',
    {
      schema: {
        operationId: 'getDesignDirection',
        description: 'Get design direction details.',
        tags: ['directions'],
        params: Type.Object({
          projectId: UuidSchema,
          directionId: UuidSchema,
        }),
        response: {
          200: GetDesignDirectionResponseSchema,
        },
      },
    },
    async () => {
      throw app.httpErrors.notImplemented('Get direction not implemented');
    },
  );
}
