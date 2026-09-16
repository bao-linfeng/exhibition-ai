import type { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import {
  CreateExportRequestSchema,
  CreateExportResponseSchema,
  ListExportsQuerySchema,
  ListExportsResponseSchema,
  GetExportResponseSchema,
  UuidSchema,
} from '@exhibition/contracts';
import type { CreateExportRequest } from '@exhibition/contracts';

export async function exportRoutes(app: FastifyInstance) {
  async function currentUser(sessionId: string | undefined) {
    return sessionId
      ? app.services!.authService.validateSession(sessionId)
      : null;
  }

  function isMemberFn(user: { id: string; role: string }) {
    return async (projectId: string) => {
      if (user.role === 'admin') return true;
      const project = await app.services!.projectService.getProject(
        projectId,
        user,
      );
      return project !== null && project !== 'forbidden';
    };
  }

  // POST /api/v1/projects/:projectId/exports
  app.post(
    '/api/v1/projects/:projectId/exports',
    {
      schema: {
        operationId: 'createExport',
        description: 'Create export task.',
        tags: ['exports'],
        params: Type.Object({ projectId: UuidSchema }),
        body: CreateExportRequestSchema,
        response: {
          202: CreateExportResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const user = await currentUser(request.cookies.sessionId);
      if (!user) throw app.httpErrors.unauthorized('Not authenticated');

      const { projectId } = request.params as { projectId: string };
      const body = request.body as CreateExportRequest;
      const result = await app.services!.exportService.createExport(
        {
          projectId,
          versionIds: body.versionIds,
          format: body.format ?? 'zip',
          requestedBy: user.id,
        },
        isMemberFn(user),
      );

      if (result === 'forbidden') throw app.httpErrors.forbidden();
      if (result === 'versions_not_found') {
        throw app.httpErrors.notFound('One or more versions were not found');
      }
      if (result === 'too_many_versions') {
        throw app.httpErrors.badRequest(
          'Too many versions requested for export',
        );
      }

      return reply.code(202).send({
        data: { taskId: result.taskId, status: 'pending' },
      });
    },
  );

  // GET /api/v1/projects/:projectId/exports
  app.get(
    '/api/v1/projects/:projectId/exports',
    {
      schema: {
        operationId: 'listExports',
        description: 'List export history.',
        tags: ['exports'],
        params: Type.Object({ projectId: UuidSchema }),
        querystring: ListExportsQuerySchema,
        response: {
          200: ListExportsResponseSchema,
        },
      },
    },
    async (request) => {
      const user = await currentUser(request.cookies.sessionId);
      if (!user) throw app.httpErrors.unauthorized('Not authenticated');

      const { projectId } = request.params as { projectId: string };
      const query = request.query as { cursor?: string; limit?: number };
      const result = await app.services!.exportService.listExports(
        { projectId, cursor: query.cursor, limit: query.limit },
        isMemberFn(user),
      );

      if (result === 'forbidden') throw app.httpErrors.forbidden();
      return result;
    },
  );

  // GET /api/v1/projects/:projectId/exports/:exportId
  app.get(
    '/api/v1/projects/:projectId/exports/:exportId',
    {
      schema: {
        operationId: 'getExport',
        description: 'Get export details.',
        tags: ['exports'],
        params: Type.Object({ projectId: UuidSchema, exportId: UuidSchema }),
        response: {
          200: GetExportResponseSchema,
        },
      },
    },
    async (request) => {
      const user = await currentUser(request.cookies.sessionId);
      if (!user) throw app.httpErrors.unauthorized('Not authenticated');

      const { projectId, exportId } = request.params as {
        projectId: string;
        exportId: string;
      };
      const result = await app.services!.exportService.getExport(
        exportId,
        projectId,
        isMemberFn(user),
      );

      if (result === 'not_found') {
        throw app.httpErrors.notFound('Export not found');
      }
      if (result === 'forbidden') throw app.httpErrors.forbidden();
      return { data: result };
    },
  );

  // GET /api/v1/projects/:projectId/exports/:exportId/download
  app.get(
    '/api/v1/projects/:projectId/exports/:exportId/download',
    {
      schema: {
        operationId: 'getExportDownloadUrl',
        description: 'Get a signed URL for a completed export.',
        tags: ['exports'],
        params: Type.Object({ projectId: UuidSchema, exportId: UuidSchema }),
        response: {
          200: Type.Object(
            {
              data: Type.Object(
                { url: Type.String(), expiresAt: Type.String() },
                { additionalProperties: false },
              ),
            },
            { additionalProperties: false },
          ),
        },
      },
    },
    async (request) => {
      const user = await currentUser(request.cookies.sessionId);
      if (!user) throw app.httpErrors.unauthorized('Not authenticated');

      const { projectId, exportId } = request.params as {
        projectId: string;
        exportId: string;
      };
      const result = await app.services!.exportService.getDownloadUrl(
        exportId,
        projectId,
        isMemberFn(user),
      );

      if (result === 'not_found') {
        throw app.httpErrors.notFound('Export not found');
      }
      if (result === 'forbidden') throw app.httpErrors.forbidden();
      if (result === 'not_ready') {
        throw app.httpErrors.conflict('Export not ready for download');
      }

      return { data: result };
    },
  );
}
