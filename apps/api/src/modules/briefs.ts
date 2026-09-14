import type { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import {
  GetBriefResponseSchema,
  UpdateBriefRequestSchema,
  UpdateBriefResponseSchema,
  ListBriefRevisionsQuerySchema,
  ListBriefRevisionsResponseSchema,
  GetBriefRevisionResponseSchema,
  UuidSchema,
} from '@exhibition/contracts';

export async function briefRoutes(app: FastifyInstance) {
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
    async () => {
      throw app.httpErrors.notImplemented('Get brief not implemented');
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
    async () => {
      throw app.httpErrors.notImplemented('Update brief not implemented');
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
    async () => {
      throw app.httpErrors.notImplemented(
        'List brief revisions not implemented',
      );
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
    async () => {
      throw app.httpErrors.notImplemented('Get brief revision not implemented');
    },
  );
}
