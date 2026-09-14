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

export async function exportRoutes(app: FastifyInstance) {
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
    async () => {
      throw app.httpErrors.notImplemented('Create export not implemented');
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
    async () => {
      throw app.httpErrors.notImplemented('List exports not implemented');
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
    async () => {
      throw app.httpErrors.notImplemented('Get export not implemented');
    },
  );
}
