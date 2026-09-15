import type { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import {
  ListAssetsQuerySchema,
  ListAssetsResponseSchema,
  CreateUploadSessionRequestSchema,
  CreateUploadSessionResponseSchema,
  CompleteUploadRequestSchema,
  CompleteUploadResponseSchema,
  GetAssetResponseSchema,
  CreateDownloadUrlRequestSchema,
  CreateDownloadUrlResponseSchema,
  UuidSchema,
} from '@exhibition/contracts';

export async function assetRoutes(app: FastifyInstance) {
  // GET /api/v1/projects/:projectId/assets
  app.get(
    '/api/v1/projects/:projectId/assets',
    {
      schema: {
        operationId: 'listAssets',
        description: 'List project assets.',
        tags: ['assets'],
        params: Type.Object({ projectId: UuidSchema }),
        querystring: ListAssetsQuerySchema,
        response: {
          200: ListAssetsResponseSchema,
        },
      },
    },
    async () => {
      throw app.httpErrors.notImplemented('List assets not implemented');
    },
  );

  // POST /api/v1/projects/:projectId/assets/uploads
  app.post(
    '/api/v1/projects/:projectId/assets/uploads',
    {
      schema: {
        operationId: 'createUploadSession',
        description: 'Create asset upload session.',
        tags: ['assets'],
        params: Type.Object({ projectId: UuidSchema }),
        body: CreateUploadSessionRequestSchema,
        response: {
          201: CreateUploadSessionResponseSchema,
        },
      },
    },
    async () => {
      throw app.httpErrors.notImplemented(
        'Create upload session not implemented',
      );
    },
  );

  // POST /api/v1/projects/:projectId/assets/uploads/:uploadId/complete
  app.post(
    '/api/v1/projects/:projectId/assets/uploads/:uploadId/complete',
    {
      schema: {
        operationId: 'completeUpload',
        description: 'Complete asset upload and trigger validation.',
        tags: ['assets'],
        params: Type.Object({ projectId: UuidSchema, uploadId: UuidSchema }),
        body: CompleteUploadRequestSchema,
        response: {
          202: CompleteUploadResponseSchema,
        },
      },
    },
    async () => {
      throw app.httpErrors.notImplemented('Complete upload not implemented');
    },
  );

  // GET /api/v1/projects/:projectId/assets/:assetId
  app.get(
    '/api/v1/projects/:projectId/assets/:assetId',
    {
      schema: {
        operationId: 'getAsset',
        description: 'Get asset details.',
        tags: ['assets'],
        params: Type.Object({ projectId: UuidSchema, assetId: UuidSchema }),
        response: {
          200: GetAssetResponseSchema,
        },
      },
    },
    async () => {
      throw app.httpErrors.notImplemented('Get asset not implemented');
    },
  );

  // POST /api/v1/projects/:projectId/assets/:assetId/download-url
  app.post(
    '/api/v1/projects/:projectId/assets/:assetId/download-url',
    {
      schema: {
        operationId: 'createDownloadUrl',
        description: 'Create signed download URL for asset.',
        tags: ['assets'],
        params: Type.Object({ projectId: UuidSchema, assetId: UuidSchema }),
        body: CreateDownloadUrlRequestSchema,
        response: {
          200: CreateDownloadUrlResponseSchema,
        },
      },
    },
    async () => {
      throw app.httpErrors.notImplemented(
        'Create download URL not implemented',
      );
    },
  );
}
