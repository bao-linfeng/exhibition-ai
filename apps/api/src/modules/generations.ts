import type { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import {
  CreateGenerationRequestSchema,
  CreateGenerationResponseSchema,
  UuidSchema,
} from '@exhibition/contracts';

export async function generationRoutes(app: FastifyInstance) {
  // POST /api/v1/projects/:projectId/generations
  app.post(
    '/api/v1/projects/:projectId/generations',
    {
      schema: {
        operationId: 'createGeneration',
        description: 'Create image generation task.',
        tags: ['generations'],
        params: Type.Object({ projectId: UuidSchema }),
        body: CreateGenerationRequestSchema,
        response: {
          202: CreateGenerationResponseSchema,
        },
      },
    },
    async () => {
      throw app.httpErrors.notImplemented('Create generation not implemented');
    },
  );
}
