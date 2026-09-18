import type { FastifyInstance } from 'fastify';
import { Type, type Static } from '@sinclair/typebox';
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
import type {
  CreateDownloadUrlRequest,
  CreateUploadSessionRequest,
} from '@exhibition/contracts';

type ListAssetsQuery = Static<typeof ListAssetsQuerySchema>;

export async function assetRoutes(app: FastifyInstance) {
  async function currentUser(sessionId: string | undefined) {
    return sessionId
      ? app.services!.authService.validateSession(sessionId)
      : null;
  }

  function canWrite(user: { role: string }) {
    return user.role === 'admin' || user.role === 'designer';
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
    async (request) => {
      const user = await currentUser(request.cookies.sessionId);
      if (!user) throw app.httpErrors.unauthorized('Not authenticated');

      const { projectId } = request.params as { projectId: string };
      const query = request.query as ListAssetsQuery;
      const result = await app.services!.assetService.listAssets(
        {
          projectId,
          kind: query.kind,
          status: query.status,
          includeHidden: query.includeHidden,
          cursor: query.cursor,
          limit: query.limit,
        },
        isMemberFn(user),
      );

      if (result === 'forbidden') throw app.httpErrors.forbidden();
      return result;
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
    async (request) => {
      const user = await currentUser(request.cookies.sessionId);
      if (!user) throw app.httpErrors.unauthorized('Not authenticated');
      if (!canWrite(user)) throw app.httpErrors.forbidden();

      const { projectId } = request.params as { projectId: string };
      const body = request.body as CreateUploadSessionRequest;
      if (!(await isMemberFn(user)(projectId))) {
        throw app.httpErrors.forbidden();
      }

      const result = await app.services!.assetService.createUploadSession({
        projectId,
        kind: body.kind,
        originalFilename: body.originalFilename,
        sizeBytes: body.sizeBytes,
        mimeType: body.mimeType,
        requestedBy: user.id,
      });

      return { data: result };
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
    async (request) => {
      const user = await currentUser(request.cookies.sessionId);
      if (!user) throw app.httpErrors.unauthorized('Not authenticated');

      const { projectId, uploadId } = request.params as {
        projectId: string;
        uploadId: string;
      };
      const result = await app.services!.assetService.completeUpload(
        uploadId,
        projectId,
        user.id,
        isMemberFn(user),
      );

      if (result === 'not_found') {
        throw app.httpErrors.notFound('Upload session not found');
      }
      if (result === 'forbidden') throw app.httpErrors.forbidden();
      if (result === 'expired') {
        throw app.httpErrors.gone('Upload session has expired');
      }
      if (result === 'not_uploaded') {
        throw app.httpErrors.unprocessableEntity(
          'Object has not been uploaded yet',
        );
      }
      if (result === 'already_completed') {
        throw app.httpErrors.conflict('Upload already completed');
      }

      void app
        .services!.auditService.log({
          eventType: 'asset.uploaded',
          actorId: user.id,
          actorEmail: user.email,
          resourceType: 'asset',
          resourceId: result.assetId,
          metadata: { projectId, validationTaskId: result.validationTaskId },
        })
        .catch(() => undefined);

      return { data: result };
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
    async (request) => {
      const user = await currentUser(request.cookies.sessionId);
      if (!user) throw app.httpErrors.unauthorized('Not authenticated');

      const { projectId, assetId } = request.params as {
        projectId: string;
        assetId: string;
      };
      const result = await app.services!.assetService.getAsset(
        assetId,
        projectId,
        isMemberFn(user),
      );

      if (result === 'not_found')
        throw app.httpErrors.notFound('Asset not found');
      if (result === 'forbidden') throw app.httpErrors.forbidden();
      return { data: result };
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
    async (request) => {
      const user = await currentUser(request.cookies.sessionId);
      if (!user) throw app.httpErrors.unauthorized('Not authenticated');

      const { projectId, assetId } = request.params as {
        projectId: string;
        assetId: string;
      };
      const body = request.body as CreateDownloadUrlRequest;
      const result = await app.services!.assetService.createDownloadUrl(
        assetId,
        projectId,
        body.variant,
        isMemberFn(user),
      );

      if (result === 'not_found')
        throw app.httpErrors.notFound('Asset not found');
      if (result === 'forbidden') throw app.httpErrors.forbidden();

      return { data: result };
    },
  );

  // DELETE /api/v1/projects/:projectId/assets/:assetId
  app.delete(
    '/api/v1/projects/:projectId/assets/:assetId',
    {
      schema: {
        operationId: 'hideAsset',
        description: 'Hide asset (soft delete).',
        tags: ['assets'],
        params: Type.Object({ projectId: UuidSchema, assetId: UuidSchema }),
        response: {
          204: Type.Null(),
        },
      },
    },
    async (request, reply) => {
      const user = await currentUser(request.cookies.sessionId);
      if (!user) throw app.httpErrors.unauthorized('Not authenticated');
      if (!canWrite(user)) throw app.httpErrors.forbidden();

      const { projectId, assetId } = request.params as {
        projectId: string;
        assetId: string;
      };
      const result = await app.services!.assetService.hideAsset(
        assetId,
        projectId,
        user.id,
        isMemberFn(user),
      );

      if (result === 'not_found')
        throw app.httpErrors.notFound('Asset not found');
      if (result === 'forbidden') throw app.httpErrors.forbidden();
      if (result === 'already_hidden')
        throw app.httpErrors.conflict('Asset already hidden');

      void app
        .services!.auditService.log({
          eventType: 'asset.hidden',
          actorId: user.id,
          actorEmail: user.email,
          resourceType: 'asset',
          resourceId: assetId,
          metadata: { projectId },
        })
        .catch(() => undefined);

      return reply.status(204).send(null);
    },
  );
}
