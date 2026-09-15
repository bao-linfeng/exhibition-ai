import type { FastifyInstance } from 'fastify';
import { Type, type Static } from '@sinclair/typebox';
import {
  CreateDesignDirectionsRequestSchema,
  CreateDesignDirectionsResponseSchema,
  ListDesignDirectionsQuerySchema,
  ListDesignDirectionsResponseSchema,
  GetDesignDirectionResponseSchema,
  UuidSchema,
} from '@exhibition/contracts';
import type { CreateDesignDirectionsRequest } from '@exhibition/contracts';

type ListDirectionsQuery = Static<typeof ListDesignDirectionsQuerySchema>;

export async function directionRoutes(app: FastifyInstance) {
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

  app.post(
    '/api/v1/projects/:projectId/design-directions',
    {
      schema: {
        operationId: 'createDesignDirections',
        description: 'Trigger design direction generation task.',
        tags: ['directions'],
        params: Type.Object({ projectId: UuidSchema }),
        body: CreateDesignDirectionsRequestSchema,
        response: { 202: CreateDesignDirectionsResponseSchema },
      },
    },
    async (request, reply) => {
      const user = await currentUser(request.cookies.sessionId);
      if (!user) throw app.httpErrors.unauthorized('Not authenticated');
      const { projectId } = request.params as { projectId: string };
      const project = await app.services!.projectService.getProject(
        projectId,
        user,
      );
      if (!project || project === 'forbidden') {
        throw app.httpErrors.notFound('Project not found');
      }
      const body = request.body as CreateDesignDirectionsRequest;
      const result = await app.services!.directionService.createDirectionsTask(
        projectId,
        body.briefRevisionId,
        body.inputAssetIds ?? [],
        body.count ?? 3,
        user.id,
        user.role,
      );
      if (result === 'forbidden') throw app.httpErrors.forbidden();
      return reply.status(202).send({ data: result });
    },
  );

  app.get(
    '/api/v1/projects/:projectId/design-directions',
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
    async (request, reply) => {
      const user = await currentUser(request.cookies.sessionId);
      if (!user) throw app.httpErrors.unauthorized('Not authenticated');
      const { projectId } = request.params as { projectId: string };
      const query = request.query as ListDirectionsQuery;
      const result = await app.services!.directionService.listDirections(
        projectId,
        query,
        await isMemberOrAdmin(projectId, user),
      );
      if (result === 'forbidden') throw app.httpErrors.forbidden();
      return reply.send(result);
    },
  );

  app.get(
    '/api/v1/projects/:projectId/design-directions/:directionId',
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
    async (request, reply) => {
      const user = await currentUser(request.cookies.sessionId);
      if (!user) throw app.httpErrors.unauthorized('Not authenticated');
      const { projectId, directionId } = request.params as {
        projectId: string;
        directionId: string;
      };
      const result = await app.services!.directionService.getDirection(
        projectId,
        directionId,
        await isMemberOrAdmin(projectId, user),
      );
      if (result === 'forbidden') throw app.httpErrors.forbidden();
      if (!result) throw app.httpErrors.notFound('Design direction not found');
      return reply.send({ data: result });
    },
  );
}
