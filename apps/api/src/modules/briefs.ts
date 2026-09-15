import type { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import {
  GetBriefResponseSchema,
  UpdateBriefRequestSchema,
  UpdateBriefResponseSchema,
  ListBriefRevisionsQuerySchema,
  ListBriefRevisionsResponseSchema,
  GetBriefRevisionResponseSchema,
  ConfirmBriefRequestSchema,
  ConfirmBriefResponseSchema,
  UuidSchema,
} from '@exhibition/contracts';
import type {
  ConfirmBriefRequest,
  UpdateBriefRequest,
} from '@exhibition/contracts';

export async function briefRoutes(app: FastifyInstance) {
  async function currentUser(sessionId: string | undefined) {
    return sessionId
      ? app.services!.authService.validateSession(sessionId)
      : null;
  }

  // GET /api/v1/projects/:projectId/brief
  app.get(
    '/api/v1/projects/:projectId/brief',
    {
      schema: {
        operationId: 'getBrief',
        description: 'Get current brief.',
        tags: ['briefs'],
        params: Type.Object({ projectId: UuidSchema }),
        response: {
          200: GetBriefResponseSchema,
        },
      },
    },
    async (request) => {
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

      const brief = await app.services!.briefService.getBrief(projectId, true);
      if (brief === 'forbidden') throw app.httpErrors.forbidden();

      return { data: brief };
    },
  );

  // PUT /api/v1/projects/:projectId/brief
  app.put(
    '/api/v1/projects/:projectId/brief',
    {
      schema: {
        operationId: 'updateBrief',
        description: 'Update brief and create new revision.',
        tags: ['briefs'],
        params: Type.Object({ projectId: UuidSchema }),
        body: UpdateBriefRequestSchema,
        response: {
          200: UpdateBriefResponseSchema,
        },
      },
    },
    async (request) => {
      const user = await currentUser(request.cookies.sessionId);
      if (!user) throw app.httpErrors.unauthorized('Not authenticated');

      const { projectId } = request.params as { projectId: string };
      const body = request.body as UpdateBriefRequest;
      const project = await app.services!.projectService.getProject(
        projectId,
        user,
      );
      if (!project || project === 'forbidden') {
        throw app.httpErrors.notFound('Project not found');
      }

      const result = await app.services!.briefService.updateBrief(
        projectId,
        body.content,
        body.expectedRevision,
        user,
        true,
      );

      if (result === 'forbidden') throw app.httpErrors.forbidden();
      if (result === 'conflict') {
        throw app.httpErrors.conflict('Revision conflict');
      }
      if (result === 'not_found') {
        throw app.httpErrors.notFound('Project not found');
      }

      void app
        .services!.auditService.log({
          eventType: 'brief.updated',
          actorId: user.id,
          actorEmail: user.email,
          projectId,
          resourceType: 'brief_revision',
          resourceId: result.id,
          metadata: { number: result.number },
        })
        .catch(() => undefined);

      return { data: result };
    },
  );

  // GET /api/v1/projects/:projectId/brief/revisions
  app.get(
    '/api/v1/projects/:projectId/brief/revisions',
    {
      schema: {
        operationId: 'listBriefRevisions',
        description: 'List brief revision history.',
        tags: ['briefs'],
        params: Type.Object({ projectId: UuidSchema }),
        querystring: ListBriefRevisionsQuerySchema,
        response: {
          200: ListBriefRevisionsResponseSchema,
        },
      },
    },
    async (request) => {
      const user = await currentUser(request.cookies.sessionId);
      if (!user) throw app.httpErrors.unauthorized('Not authenticated');

      const { projectId } = request.params as { projectId: string };
      const query = request.query as { cursor?: string; limit?: number };
      const project = await app.services!.projectService.getProject(
        projectId,
        user,
      );
      if (!project || project === 'forbidden') {
        throw app.httpErrors.notFound('Project not found');
      }

      const result = await app.services!.briefService.listRevisions(
        projectId,
        query,
        true,
      );
      if (result === 'forbidden') throw app.httpErrors.forbidden();

      return result;
    },
  );

  // GET /api/v1/projects/:projectId/brief/revisions/:revisionId
  app.get(
    '/api/v1/projects/:projectId/brief/revisions/:revisionId',
    {
      schema: {
        operationId: 'getBriefRevision',
        description: 'Get specific brief revision.',
        tags: ['briefs'],
        params: Type.Object({ projectId: UuidSchema, revisionId: UuidSchema }),
        response: {
          200: GetBriefRevisionResponseSchema,
        },
      },
    },
    async (request) => {
      const user = await currentUser(request.cookies.sessionId);
      if (!user) throw app.httpErrors.unauthorized('Not authenticated');

      const { projectId, revisionId } = request.params as {
        projectId: string;
        revisionId: string;
      };
      const project = await app.services!.projectService.getProject(
        projectId,
        user,
      );
      if (!project || project === 'forbidden') {
        throw app.httpErrors.notFound('Project not found');
      }

      const revision = await app.services!.briefService.getRevision(
        projectId,
        revisionId,
        true,
      );
      if (revision === 'forbidden') throw app.httpErrors.forbidden();
      if (!revision) {
        throw app.httpErrors.notFound('Brief revision not found');
      }

      return { data: revision };
    },
  );

  // POST /api/v1/projects/:projectId/brief/confirm
  app.post(
    '/api/v1/projects/:projectId/brief/confirm',
    {
      schema: {
        operationId: 'confirmBrief',
        description: 'Confirm current brief revision.',
        tags: ['briefs'],
        params: Type.Object({ projectId: UuidSchema }),
        body: ConfirmBriefRequestSchema,
        response: {
          200: ConfirmBriefResponseSchema,
        },
      },
    },
    async (request) => {
      const user = await currentUser(request.cookies.sessionId);
      if (!user) throw app.httpErrors.unauthorized('Not authenticated');

      const { projectId } = request.params as { projectId: string };
      const body = request.body as ConfirmBriefRequest;
      const project = await app.services!.projectService.getProject(
        projectId,
        user,
      );
      if (!project || project === 'forbidden') {
        throw app.httpErrors.notFound('Project not found');
      }

      const result = await app.services!.briefService.confirmBrief(
        projectId,
        body.briefRevisionId,
        body.expectedRevision,
        user,
        true,
      );

      if (result === 'forbidden') throw app.httpErrors.forbidden();
      if (result === 'conflict') {
        throw app.httpErrors.conflict('Revision conflict');
      }
      if (result === 'not_found') {
        throw app.httpErrors.notFound('Brief revision not found');
      }
      if (result === 'wrong_revision') {
        throw app.httpErrors.conflict(
          'Can only confirm the current brief revision',
        );
      }

      void app
        .services!.auditService.log({
          eventType: 'brief.confirmed',
          actorId: user.id,
          actorEmail: user.email,
          projectId,
          resourceType: 'brief_revision',
          resourceId: result.id,
          metadata: { number: result.number },
        })
        .catch(() => undefined);

      return { data: result };
    },
  );
}
