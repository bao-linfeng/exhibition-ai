import type { FastifyInstance } from 'fastify';
import { Type, type Static } from '@sinclair/typebox';
import {
  ListAssetFavoritesQuerySchema,
  ListAssetFavoritesResponseSchema,
  ListImageVersionFavoritesQuerySchema,
  ListImageVersionFavoritesResponseSchema,
  UuidSchema,
} from '@exhibition/contracts';

type ListFavoritesQuery = Static<typeof ListAssetFavoritesQuerySchema>;

export async function favoriteRoutes(app: FastifyInstance) {
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

  app.put(
    '/api/v1/projects/:projectId/favorites/assets/:assetId',
    {
      schema: {
        operationId: 'setAssetFavorite',
        description: 'Add asset to favorites.',
        tags: ['favorites'],
        params: Type.Object({ projectId: UuidSchema, assetId: UuidSchema }),
        response: { 204: Type.Null() },
      },
    },
    async (request, reply) => {
      const user = await currentUser(request.cookies.sessionId);
      if (!user) throw app.httpErrors.unauthorized('Not authenticated');
      const { projectId, assetId } = request.params as {
        projectId: string;
        assetId: string;
      };
      const isMember = await isMemberFn(user)(projectId);
      const result = await app.services!.favoriteService.setAssetFavorite(
        projectId,
        assetId,
        user.id,
        isMember,
      );
      if (result === 'forbidden') throw app.httpErrors.forbidden();
      return reply.code(204).send(null);
    },
  );

  app.delete(
    '/api/v1/projects/:projectId/favorites/assets/:assetId',
    {
      schema: {
        operationId: 'unsetAssetFavorite',
        description: 'Remove asset from favorites.',
        tags: ['favorites'],
        params: Type.Object({ projectId: UuidSchema, assetId: UuidSchema }),
        response: { 204: Type.Null() },
      },
    },
    async (request, reply) => {
      const user = await currentUser(request.cookies.sessionId);
      if (!user) throw app.httpErrors.unauthorized('Not authenticated');
      const { projectId, assetId } = request.params as {
        projectId: string;
        assetId: string;
      };
      const isMember = await isMemberFn(user)(projectId);
      const result = await app.services!.favoriteService.unsetAssetFavorite(
        projectId,
        assetId,
        user.id,
        isMember,
      );
      if (result === 'forbidden') throw app.httpErrors.forbidden();
      return reply.code(204).send(null);
    },
  );

  app.get(
    '/api/v1/projects/:projectId/favorites/assets',
    {
      schema: {
        operationId: 'listAssetFavorites',
        description: 'List asset favorites for current user in project.',
        tags: ['favorites'],
        params: Type.Object({ projectId: UuidSchema }),
        querystring: ListAssetFavoritesQuerySchema,
        response: { 200: ListAssetFavoritesResponseSchema },
      },
    },
    async (request) => {
      const user = await currentUser(request.cookies.sessionId);
      if (!user) throw app.httpErrors.unauthorized('Not authenticated');
      const { projectId } = request.params as { projectId: string };
      const query = request.query as ListFavoritesQuery;
      const isMember = await isMemberFn(user)(projectId);
      const result = await app.services!.favoriteService.listAssetFavorites(
        projectId,
        user.id,
        { cursor: query.cursor, limit: query.limit },
        isMember,
      );
      if (result === 'forbidden') throw app.httpErrors.forbidden();
      return result;
    },
  );

  app.put(
    '/api/v1/projects/:projectId/favorites/versions/:versionId',
    {
      schema: {
        operationId: 'setVersionFavorite',
        description: 'Add version to favorites.',
        tags: ['favorites'],
        params: Type.Object({ projectId: UuidSchema, versionId: UuidSchema }),
        response: { 204: Type.Null() },
      },
    },
    async (request, reply) => {
      const user = await currentUser(request.cookies.sessionId);
      if (!user) throw app.httpErrors.unauthorized('Not authenticated');
      const { projectId, versionId } = request.params as {
        projectId: string;
        versionId: string;
      };
      const isMember = await isMemberFn(user)(projectId);
      const result = await app.services!.favoriteService.setVersionFavorite(
        projectId,
        versionId,
        user.id,
        isMember,
      );
      if (result === 'forbidden') throw app.httpErrors.forbidden();
      return reply.code(204).send(null);
    },
  );

  app.delete(
    '/api/v1/projects/:projectId/favorites/versions/:versionId',
    {
      schema: {
        operationId: 'unsetVersionFavorite',
        description: 'Remove version from favorites.',
        tags: ['favorites'],
        params: Type.Object({ projectId: UuidSchema, versionId: UuidSchema }),
        response: { 204: Type.Null() },
      },
    },
    async (request, reply) => {
      const user = await currentUser(request.cookies.sessionId);
      if (!user) throw app.httpErrors.unauthorized('Not authenticated');
      const { projectId, versionId } = request.params as {
        projectId: string;
        versionId: string;
      };
      const isMember = await isMemberFn(user)(projectId);
      const result = await app.services!.favoriteService.unsetVersionFavorite(
        projectId,
        versionId,
        user.id,
        isMember,
      );
      if (result === 'forbidden') throw app.httpErrors.forbidden();
      return reply.code(204).send(null);
    },
  );

  app.get(
    '/api/v1/projects/:projectId/favorites/versions',
    {
      schema: {
        operationId: 'listVersionFavorites',
        description: 'List version favorites for current user in project.',
        tags: ['favorites'],
        params: Type.Object({ projectId: UuidSchema }),
        querystring: ListImageVersionFavoritesQuerySchema,
        response: { 200: ListImageVersionFavoritesResponseSchema },
      },
    },
    async (request) => {
      const user = await currentUser(request.cookies.sessionId);
      if (!user) throw app.httpErrors.unauthorized('Not authenticated');
      const { projectId } = request.params as { projectId: string };
      const query = request.query as ListFavoritesQuery;
      const isMember = await isMemberFn(user)(projectId);
      const result = await app.services!.favoriteService.listVersionFavorites(
        projectId,
        user.id,
        { cursor: query.cursor, limit: query.limit },
        isMember,
      );
      if (result === 'forbidden') throw app.httpErrors.forbidden();
      return result;
    },
  );
}
