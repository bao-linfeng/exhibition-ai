import type { FastifyInstance } from 'fastify';
import { Type, type Static } from '@sinclair/typebox';
import {
  ListImageVersionsQuerySchema,
  ListImageVersionsResponseSchema,
  GetImageVersionResponseSchema,
  UpdateSelectedVersionRequestSchema,
  UpdateSelectedVersionResponseSchema,
  HideVersionRequestSchema,
  UuidSchema,
} from '@exhibition/contracts';

type ListImageVersionsQuery = Static<typeof ListImageVersionsQuerySchema>;
type UpdateSelectedVersionRequest = Static<
  typeof UpdateSelectedVersionRequestSchema
>;

export async function versionRoutes(app: FastifyInstance) {
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
    async (request, reply) => {
      const user = await currentUser(request.cookies.sessionId);
      if (!user) throw app.httpErrors.unauthorized('Not authenticated');

      const { projectId } = request.params as { projectId: string };
      const query = request.query as ListImageVersionsQuery;

      const result = await app.services!.imageVersionService.listVersions(
        projectId,
        {
          parentVersionId: query.parentVersionId,
          briefRevisionId: query.briefRevisionId,
          cursor: query.cursor,
          limit: query.limit,
        },
        await isMemberOrAdmin(projectId, user),
      );

      if (result === 'forbidden') throw app.httpErrors.forbidden();
      return reply.send(result);
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
    async (request, reply) => {
      const user = await currentUser(request.cookies.sessionId);
      if (!user) throw app.httpErrors.unauthorized('Not authenticated');

      const { id } = request.params as { id: string };

      // Lookup without projectId restriction to get projectId first
      const version = await app.services!.imageVersionService.getVersion(
        id,
        true, // admin-level lookup; permission re-checked below with real projectId
      );
      if (version === 'not_found') throw app.httpErrors.notFound();
      if (version === 'forbidden') throw app.httpErrors.forbidden();

      const allowed = await isMemberOrAdmin(version.projectId, user);
      if (!allowed) throw app.httpErrors.forbidden();

      return reply.send({ data: version });
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
    async (request, reply) => {
      const user = await currentUser(request.cookies.sessionId);
      if (!user) throw app.httpErrors.unauthorized('Not authenticated');

      const { projectId } = request.params as { projectId: string };
      const body = request.body as UpdateSelectedVersionRequest;

      const result =
        await app.services!.imageVersionService.updateSelectedVersion(
          projectId,
          body.versionId,
          body.expectedRevision,
          await isMemberOrAdmin(projectId, user),
        );

      if (result === 'forbidden') throw app.httpErrors.forbidden();
      if (result === 'version_not_found')
        throw app.httpErrors.notFound('Version not found');
      if (result === 'conflict')
        throw app.httpErrors.conflict('Revision conflict');

      return reply.send({ data: result });
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
    async (request, reply) => {
      const user = await currentUser(request.cookies.sessionId);
      if (!user) throw app.httpErrors.unauthorized('Not authenticated');

      const { id } = request.params as { id: string };

      // Lookup to get projectId for permission check
      const version = await app.services!.imageVersionService.getVersion(
        id,
        true,
      );
      if (version === 'not_found') throw app.httpErrors.notFound();
      if (version === 'forbidden') throw app.httpErrors.forbidden();

      const allowed = await isMemberOrAdmin(version.projectId, user);
      if (!allowed) throw app.httpErrors.forbidden();

      const result = await app.services!.imageVersionService.hideVersion(
        id,
        version.projectId,
        true,
      );

      if (result === 'not_found') throw app.httpErrors.notFound();
      if (result === 'forbidden') throw app.httpErrors.forbidden();
      if (result === 'already_hidden')
        throw app.httpErrors.conflict('Version already hidden');

      return reply.status(204).send(null);
    },
  );
}
