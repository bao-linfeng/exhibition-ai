import type { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import {
  ListImageVersionsQuerySchema,
  ListImageVersionsResponseSchema,
  GetImageVersionResponseSchema,
  UpdateSelectedVersionRequestSchema,
  UpdateSelectedVersionResponseSchema,
  HideVersionRequestSchema,
  UuidSchema,
} from '@exhibition/contracts';

export async function versionRoutes(app: FastifyInstance) {
  // GET /api/v1/projects/:projectId/versions
  app.get(
    '/api/v1/projects/:projectId/versions',
    {
      schema: {
        operationId: 'listImageVersions',
        description: 'List image versions.',
        tags: ['versions'],
        params: Type.Object({ projectId: UuidSchema }),
        querystring: ListImageVersionsQuerySchema,
        response: {
          200: ListImageVersionsResponseSchema,
        },
      },
    },
    async () => {
      throw app.httpErrors.notImplemented('List versions not implemented');
    },
  );

  // GET /api/v1/versions/:id
  app.get(
    '/api/v1/versions/:id',
    {
      schema: {
        operationId: 'getImageVersion',
        description: 'Get version details.',
        tags: ['versions'],
        params: Type.Object({ id: UuidSchema }),
        response: {
          200: GetImageVersionResponseSchema,
        },
      },
    },
    async () => {
      throw app.httpErrors.notImplemented('Get version not implemented');
    },
  );

  // PUT /api/v1/projects/:projectId/selected-version
  app.put(
    '/api/v1/projects/:projectId/selected-version',
    {
      schema: {
        operationId: 'updateSelectedVersion',
        description: 'Select version as current.',
        tags: ['versions'],
        params: Type.Object({ projectId: UuidSchema }),
        body: UpdateSelectedVersionRequestSchema,
        response: {
          200: UpdateSelectedVersionResponseSchema,
        },
      },
    },
    async () => {
      throw app.httpErrors.notImplemented('Select version not implemented');
    },
  );

  // POST /api/v1/versions/:id/hide
  app.post(
    '/api/v1/versions/:id/hide',
    {
      schema: {
        operationId: 'hideVersion',
        description: 'Hide version from UI.',
        tags: ['versions'],
        params: Type.Object({ id: UuidSchema }),
        body: HideVersionRequestSchema,
        response: {
          204: Type.Null(),
        },
      },
    },
    async () => {
      throw app.httpErrors.notImplemented('Hide version not implemented');
    },
  );
}
