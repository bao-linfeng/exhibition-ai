import type { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import {
  CreateTagRequestSchema,
  CreateTagResponseSchema,
  ListTagsResponseSchema,
  UpdateTagRequestSchema,
  UpdateTagResponseSchema,
  UuidSchema,
} from '@exhibition/contracts';
import type { CreateTagRequest, UpdateTagRequest } from '@exhibition/contracts';

export async function tagRoutes(app: FastifyInstance) {
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

  app.get(
    '/api/v1/projects/:projectId/tags',
    {
      schema: {
        operationId: 'listTags',
        description: 'List project tags.',
        tags: ['tags'],
        params: Type.Object({ projectId: UuidSchema }),
        response: { 200: ListTagsResponseSchema },
      },
    },
    async (request) => {
      const user = await currentUser(request.cookies.sessionId);
      if (!user) throw app.httpErrors.unauthorized('Not authenticated');
      const { projectId } = request.params as { projectId: string };
      const isMember = await isMemberFn(user)(projectId);
      const result = await app.services!.tagService.listTags(
        projectId,
        isMember,
      );
      if (result === 'forbidden') throw app.httpErrors.forbidden();
      return { data: result };
    },
  );

  app.post(
    '/api/v1/projects/:projectId/tags',
    {
      schema: {
        operationId: 'createTag',
        description: 'Create a project tag.',
        tags: ['tags'],
        params: Type.Object({ projectId: UuidSchema }),
        body: CreateTagRequestSchema,
        response: { 201: CreateTagResponseSchema },
      },
    },
    async (request, reply) => {
      const user = await currentUser(request.cookies.sessionId);
      if (!user) throw app.httpErrors.unauthorized('Not authenticated');
      const { projectId } = request.params as { projectId: string };
      const body = request.body as CreateTagRequest;
      const isMember = await isMemberFn(user)(projectId);
      const result = await app.services!.tagService.createTag(
        projectId,
        body,
        user.id,
        user,
        isMember,
      );
      if (result === 'forbidden') throw app.httpErrors.forbidden();
      if (result === 'project_not_found')
        throw app.httpErrors.notFound('Project not found');
      if (result === 'project_archived')
        throw app.httpErrors.conflict('Project is archived');
      if (result === 'project_tag_limit_reached')
        throw app.httpErrors.conflict('Project tag limit reached (50)');
      if (result === 'name_conflict')
        throw app.httpErrors.conflict(
          'Tag name already exists in this project',
        );
      return reply.code(201).send({ data: result });
    },
  );

  app.patch(
    '/api/v1/projects/:projectId/tags/:tagId',
    {
      schema: {
        operationId: 'updateTag',
        description: 'Update a project tag.',
        tags: ['tags'],
        params: Type.Object({ projectId: UuidSchema, tagId: UuidSchema }),
        body: UpdateTagRequestSchema,
        response: { 200: UpdateTagResponseSchema },
      },
    },
    async (request) => {
      const user = await currentUser(request.cookies.sessionId);
      if (!user) throw app.httpErrors.unauthorized('Not authenticated');
      const { projectId, tagId } = request.params as {
        projectId: string;
        tagId: string;
      };
      const body = request.body as UpdateTagRequest;
      const isMember = await isMemberFn(user)(projectId);
      const result = await app.services!.tagService.updateTag(
        projectId,
        tagId,
        body,
        user.id,
        user,
        isMember,
      );
      if (result === 'forbidden') throw app.httpErrors.forbidden();
      if (result === 'not_found')
        throw app.httpErrors.notFound('Tag not found');
      if (result === 'project_archived')
        throw app.httpErrors.conflict('Project is archived');
      if (result === 'name_conflict')
        throw app.httpErrors.conflict(
          'Tag name already exists in this project',
        );
      return { data: result };
    },
  );

  app.delete(
    '/api/v1/projects/:projectId/tags/:tagId',
    {
      schema: {
        operationId: 'deleteTag',
        description: 'Delete a project tag.',
        tags: ['tags'],
        params: Type.Object({ projectId: UuidSchema, tagId: UuidSchema }),
        response: { 204: Type.Null() },
      },
    },
    async (request, reply) => {
      const user = await currentUser(request.cookies.sessionId);
      if (!user) throw app.httpErrors.unauthorized('Not authenticated');
      const { projectId, tagId } = request.params as {
        projectId: string;
        tagId: string;
      };
      const isMember = await isMemberFn(user)(projectId);
      const result = await app.services!.tagService.deleteTag(
        projectId,
        tagId,
        user.id,
        user,
        isMember,
      );
      if (result === 'forbidden') throw app.httpErrors.forbidden();
      if (result === 'not_found')
        throw app.httpErrors.notFound('Tag not found');
      if (result === 'project_archived')
        throw app.httpErrors.conflict('Project is archived');
      return reply.code(204).send(null);
    },
  );

  app.put(
    '/api/v1/projects/:projectId/tags/:tagId/assets/:assetId',
    {
      schema: {
        operationId: 'assignTagToAsset',
        description: 'Assign tag to asset.',
        tags: ['tags'],
        params: Type.Object({
          projectId: UuidSchema,
          tagId: UuidSchema,
          assetId: UuidSchema,
        }),
        response: { 204: Type.Null() },
      },
    },
    async (request, reply) => {
      const user = await currentUser(request.cookies.sessionId);
      if (!user) throw app.httpErrors.unauthorized('Not authenticated');
      const { projectId, tagId, assetId } = request.params as {
        projectId: string;
        tagId: string;
        assetId: string;
      };
      const isMember = await isMemberFn(user)(projectId);
      const result = await app.services!.tagService.assignTagToAsset(
        projectId,
        tagId,
        assetId,
        user.id,
        user,
        isMember,
      );
      if (result === 'forbidden') throw app.httpErrors.forbidden();
      if (result === 'tag_not_found')
        throw app.httpErrors.notFound('Tag not found');
      if (result === 'resource_not_found')
        throw app.httpErrors.notFound('Asset not found');
      if (result === 'project_archived')
        throw app.httpErrors.conflict('Project is archived');
      if (result === 'project_mismatch')
        throw app.httpErrors.badRequest(
          'Resource does not belong to this project',
        );
      if (result === 'resource_tag_limit_reached')
        throw app.httpErrors.conflict('Resource tag limit reached (10)');
      return reply.code(204).send(null);
    },
  );

  app.delete(
    '/api/v1/projects/:projectId/tags/:tagId/assets/:assetId',
    {
      schema: {
        operationId: 'unassignTagFromAsset',
        description: 'Unassign tag from asset.',
        tags: ['tags'],
        params: Type.Object({
          projectId: UuidSchema,
          tagId: UuidSchema,
          assetId: UuidSchema,
        }),
        response: { 204: Type.Null() },
      },
    },
    async (request, reply) => {
      const user = await currentUser(request.cookies.sessionId);
      if (!user) throw app.httpErrors.unauthorized('Not authenticated');
      const { projectId, tagId, assetId } = request.params as {
        projectId: string;
        tagId: string;
        assetId: string;
      };
      const isMember = await isMemberFn(user)(projectId);
      const result = await app.services!.tagService.unassignTagFromAsset(
        projectId,
        tagId,
        assetId,
        user.id,
        user,
        isMember,
      );
      if (result === 'forbidden') throw app.httpErrors.forbidden();
      if (result === 'tag_not_found')
        throw app.httpErrors.notFound('Tag not found');
      if (result === 'project_archived')
        throw app.httpErrors.conflict('Project is archived');
      return reply.code(204).send(null);
    },
  );

  app.put(
    '/api/v1/projects/:projectId/tags/:tagId/versions/:versionId',
    {
      schema: {
        operationId: 'assignTagToVersion',
        description: 'Assign tag to image version.',
        tags: ['tags'],
        params: Type.Object({
          projectId: UuidSchema,
          tagId: UuidSchema,
          versionId: UuidSchema,
        }),
        response: { 204: Type.Null() },
      },
    },
    async (request, reply) => {
      const user = await currentUser(request.cookies.sessionId);
      if (!user) throw app.httpErrors.unauthorized('Not authenticated');
      const { projectId, tagId, versionId } = request.params as {
        projectId: string;
        tagId: string;
        versionId: string;
      };
      const isMember = await isMemberFn(user)(projectId);
      const result = await app.services!.tagService.assignTagToVersion(
        projectId,
        tagId,
        versionId,
        user.id,
        user,
        isMember,
      );
      if (result === 'forbidden') throw app.httpErrors.forbidden();
      if (result === 'tag_not_found')
        throw app.httpErrors.notFound('Tag not found');
      if (result === 'resource_not_found')
        throw app.httpErrors.notFound('Version not found');
      if (result === 'project_archived')
        throw app.httpErrors.conflict('Project is archived');
      if (result === 'project_mismatch')
        throw app.httpErrors.badRequest(
          'Resource does not belong to this project',
        );
      if (result === 'resource_tag_limit_reached')
        throw app.httpErrors.conflict('Resource tag limit reached (10)');
      return reply.code(204).send(null);
    },
  );

  app.delete(
    '/api/v1/projects/:projectId/tags/:tagId/versions/:versionId',
    {
      schema: {
        operationId: 'unassignTagFromVersion',
        description: 'Unassign tag from image version.',
        tags: ['tags'],
        params: Type.Object({
          projectId: UuidSchema,
          tagId: UuidSchema,
          versionId: UuidSchema,
        }),
        response: { 204: Type.Null() },
      },
    },
    async (request, reply) => {
      const user = await currentUser(request.cookies.sessionId);
      if (!user) throw app.httpErrors.unauthorized('Not authenticated');
      const { projectId, tagId, versionId } = request.params as {
        projectId: string;
        tagId: string;
        versionId: string;
      };
      const isMember = await isMemberFn(user)(projectId);
      const result = await app.services!.tagService.unassignTagFromVersion(
        projectId,
        tagId,
        versionId,
        user.id,
        user,
        isMember,
      );
      if (result === 'forbidden') throw app.httpErrors.forbidden();
      if (result === 'tag_not_found')
        throw app.httpErrors.notFound('Tag not found');
      if (result === 'project_archived')
        throw app.httpErrors.conflict('Project is archived');
      return reply.code(204).send(null);
    },
  );
}
