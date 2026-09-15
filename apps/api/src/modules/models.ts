import type { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import {
  ListModelConfigsResponseSchema,
  GetModelConfigResponseSchema,
  UuidSchema,
} from '@exhibition/contracts';

export async function modelRoutes(app: FastifyInstance) {
  async function currentUser(sessionId: string | undefined) {
    return sessionId
      ? app.services!.authService.validateSession(sessionId)
      : null;
  }

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
    async (request) => {
      const user = await currentUser(request.cookies.sessionId);
      if (!user) throw app.httpErrors.unauthorized('Not authenticated');
      const configs =
        await app.services!.settingsService.listModelConfigs(true);
      return {
        data: configs.map((c) => ({
          id: c.id,
          providerId: c.providerId,
          modelId: c.modelId,
          displayName: c.displayName,
          description: c.description ?? undefined,
          capabilities: (c.capabilities as string[]) ?? [],
          costPerImageMinor: c.costPerImageMinor,
          currency: c.currency,
          isActive: c.isActive,
          maxConcurrent: c.maxConcurrent,
          createdAt: c.createdAt.toISOString(),
          updatedAt: c.updatedAt.toISOString(),
        })),
      };
    },
  );

  // GET /api/v1/models/:id
  app.get(
    '/api/v1/models/:id',
    {
      schema: {
        operationId: 'getModelConfig',
        description: 'Get a single AI model config by id.',
        tags: ['models'],
        params: Type.Object({ id: UuidSchema }),
        response: {
          200: GetModelConfigResponseSchema,
        },
      },
    },
    async (request) => {
      const user = await currentUser(request.cookies.sessionId);
      if (!user) throw app.httpErrors.unauthorized('Not authenticated');
      const { id } = request.params as { id: string };
      const config = await app.services!.settingsService.getModelConfig(id);
      if (!config) throw app.httpErrors.notFound('Model config not found');
      return {
        data: {
          id: config.id,
          providerId: config.providerId,
          modelId: config.modelId,
          displayName: config.displayName,
          description: config.description ?? undefined,
          capabilities: (config.capabilities as string[]) ?? [],
          costPerImageMinor: config.costPerImageMinor,
          currency: config.currency,
          isActive: config.isActive,
          maxConcurrent: config.maxConcurrent,
          createdAt: config.createdAt.toISOString(),
          updatedAt: config.updatedAt.toISOString(),
        },
      };
    },
  );
}
