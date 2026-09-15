import type { FastifyInstance } from 'fastify';
import { Type, type Static } from '@sinclair/typebox';
import {
  CreateGenerationRequestSchema,
  CreateGenerationResponseSchema,
  ListGenerationsQuerySchema,
  ListGenerationsResponseSchema,
  UuidSchema,
} from '@exhibition/contracts';
import type { CreateGenerationRequest } from '@exhibition/contracts';

type ListGenerationsQuery = Static<typeof ListGenerationsQuerySchema>;

export async function generationRoutes(app: FastifyInstance) {
  async function currentUser(sessionId: string | undefined) {
    return sessionId
      ? app.services!.authService.validateSession(sessionId)
      : null;
  }

  async function isMemberOrAdmin(
    projectId: string,
    user: { id: string; role: string },
  ) {
    if (user.role === 'admin') return true;
    const project = await app.services!.projectService.getProject(
      projectId,
      user,
    );
    return project !== null && project !== 'forbidden';
  }

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
    async (request, reply) => {
      const user = await currentUser(request.cookies.sessionId);
      if (!user) throw app.httpErrors.unauthorized('Not authenticated');

      const { projectId } = request.params as { projectId: string };
      const body = request.body as CreateGenerationRequest;
      const result = await app.services!.generationService.createGeneration(
        projectId,
        body,
        user.id,
        await isMemberOrAdmin(projectId, user),
      );

      if (result === 'forbidden') throw app.httpErrors.forbidden();
      if (result === 'conflict') {
        throw app.httpErrors.conflict('Idempotency conflict');
      }

      return reply.status(202).send({ data: result });
    },
  );

  // GET /api/v1/projects/:projectId/generations
  app.get(
    '/api/v1/projects/:projectId/generations',
    {
      schema: {
        operationId: 'listGenerations',
        description: 'List image generation tasks for a project.',
        tags: ['generations'],
        params: Type.Object({ projectId: UuidSchema }),
        querystring: ListGenerationsQuerySchema,
        response: {
          200: ListGenerationsResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const user = await currentUser(request.cookies.sessionId);
      if (!user) throw app.httpErrors.unauthorized('Not authenticated');

      const { projectId } = request.params as { projectId: string };
      const query = request.query as ListGenerationsQuery;
      const result = await app.services!.generationService.listGenerations(
        projectId,
        {
          status: query.status,
          cursor: query.cursor,
          limit: query.limit,
        },
        await isMemberOrAdmin(projectId, user),
      );

      if (result === 'forbidden') throw app.httpErrors.forbidden();
      return reply.send(result);
    },
  );
}
