import type { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import {
  ListProjectsQuerySchema,
  ListProjectsResponseSchema,
  CreateProjectRequestSchema,
  CreateProjectResponseSchema,
  GetProjectResponseSchema,
  UpdateProjectRequestSchema,
  UpdateProjectResponseSchema,
  ListProjectMembersResponseSchema,
  AddProjectMemberRequestSchema,
  AddProjectMemberResponseSchema,
  RemoveProjectMemberRequestSchema,
  TransferOwnerRequestSchema,
  TransferOwnerResponseSchema,
  ProjectTransitionRequestSchema,
  ProjectTransitionResponseSchema,
  UuidSchema,
} from '@exhibition/contracts';
import type {
  CreateProjectRequest,
  Project as ProjectContract,
  ProjectTransitionRequest,
  UpdateProjectRequest,
} from '@exhibition/contracts';

export async function projectRoutes(app: FastifyInstance) {
  async function currentUser(sessionId: string | undefined) {
    return sessionId
      ? app.services!.authService.validateSession(sessionId)
      : null;
  }

  app.get(
    '/api/v1/projects',
    {
      schema: {
        operationId: 'listProjects',
        description: 'List projects with filtering.',
        tags: ['projects'],
        querystring: ListProjectsQuerySchema,
        response: {
          200: ListProjectsResponseSchema,
        },
      },
    },
    async (request) => {
      const user = await currentUser(request.cookies.sessionId);
      if (!user) throw app.httpErrors.unauthorized('Not authenticated');

      const result = await app.services!.projectService.listProjects(
        request.query as {
          status?:
            | 'draft'
            | 'briefing'
            | 'designing'
            | 'reviewing'
            | 'approved'
            | 'archived';
          customerId?: string;
          ownerId?: string;
          search?: string;
          cursor?: string;
          limit?: number;
        },
        user,
      );

      if (result === 'forbidden') throw app.httpErrors.forbidden();
      return result;
    },
  );

  app.post(
    '/api/v1/projects',
    {
      schema: {
        operationId: 'createProject',
        description: 'Create a new project.',
        tags: ['projects'],
        body: CreateProjectRequestSchema,
        response: {
          201: CreateProjectResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const user = await currentUser(request.cookies.sessionId);
      if (!user) throw app.httpErrors.unauthorized('Not authenticated');

      const project = await app.services!.projectService.createProject(
        request.body as CreateProjectRequest,
        user.id,
        user,
      );

      if (project === 'forbidden') throw app.httpErrors.forbidden();
      return reply.code(201).send({ data: project });
    },
  );

  app.get(
    '/api/v1/projects/:id',
    {
      schema: {
        operationId: 'getProject',
        description: 'Get project details.',
        tags: ['projects'],
        params: Type.Object({ id: UuidSchema }),
        response: {
          200: GetProjectResponseSchema,
        },
      },
    },
    async (request) => {
      const user = await currentUser(request.cookies.sessionId);
      if (!user) throw app.httpErrors.unauthorized('Not authenticated');

      const project = await app.services!.projectService.getProject(
        (request.params as { id: string }).id,
        user,
      );

      if (project === 'forbidden') {
        throw app.httpErrors.notFound('Project not found');
      }
      if (!project) throw app.httpErrors.notFound('Project not found');

      return { data: project };
    },
  );

  app.patch(
    '/api/v1/projects/:id',
    {
      schema: {
        operationId: 'updateProject',
        description: 'Update project details.',
        tags: ['projects'],
        params: Type.Object({ id: UuidSchema }),
        body: UpdateProjectRequestSchema,
        response: {
          200: UpdateProjectResponseSchema,
        },
      },
    },
    async (request) => {
      const user = await currentUser(request.cookies.sessionId);
      if (!user) throw app.httpErrors.unauthorized('Not authenticated');

      const body = request.body as UpdateProjectRequest;
      const result = await app.services!.projectService.updateProject(
        (request.params as { id: string }).id,
        body,
        body.expectedRevision,
        user,
      );

      if (result === 'forbidden') throw app.httpErrors.forbidden();
      if (result === 'conflict') {
        throw app.httpErrors.conflict('Project revision conflict');
      }
      if (!result) throw app.httpErrors.notFound('Project not found');

      return { data: result };
    },
  );

  app.get(
    '/api/v1/projects/:id/members',
    {
      schema: {
        operationId: 'listProjectMembers',
        description: 'List project members.',
        tags: ['projects'],
        params: Type.Object({ id: UuidSchema }),
        response: {
          200: ListProjectMembersResponseSchema,
        },
      },
    },
    async (request) => {
      const user = await currentUser(request.cookies.sessionId);
      if (!user) throw app.httpErrors.unauthorized('Not authenticated');

      const { id } = request.params as { id: string };
      const members = await app.services!.projectService.listMembers(id, user);

      if (members === 'forbidden' || !members) {
        throw app.httpErrors.notFound('Project not found');
      }

      return { data: members };
    },
  );

  app.post(
    '/api/v1/projects/:id/members',
    {
      schema: {
        operationId: 'addProjectMember',
        description: 'Add member to project.',
        tags: ['projects'],
        params: Type.Object({ id: UuidSchema }),
        body: AddProjectMemberRequestSchema,
        response: {
          201: AddProjectMemberResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const user = await currentUser(request.cookies.sessionId);
      if (!user) throw app.httpErrors.unauthorized('Not authenticated');

      const { id } = request.params as { id: string };
      const body = request.body as { userId: string };
      const project = await app.services!.projectService.getProject(id, user);

      if (project === 'forbidden' || !project) {
        throw app.httpErrors.notFound('Project not found');
      }

      const member = await app.services!.projectService.addMember(
        id,
        body.userId,
        user.id,
        user,
      );

      if (member === 'forbidden') throw app.httpErrors.forbidden();
      if (!member) {
        throw app.httpErrors.conflict('Project member already exists');
      }

      return reply.code(201).send({ data: member });
    },
  );

  app.delete(
    '/api/v1/projects/:id/members/:userId',
    {
      schema: {
        operationId: 'removeProjectMember',
        description: 'Remove member from project.',
        tags: ['projects'],
        params: Type.Object({ id: UuidSchema, userId: UuidSchema }),
        body: RemoveProjectMemberRequestSchema,
        response: {
          204: { type: 'null', description: 'No content' },
        },
      },
    },
    async (request, reply) => {
      const user = await currentUser(request.cookies.sessionId);
      if (!user) throw app.httpErrors.unauthorized('Not authenticated');

      const { id, userId } = request.params as { id: string; userId: string };
      const body = request.body as { expectedRevision: number };
      const project = await app.services!.projectService.getProject(id, user);

      if (project === 'forbidden' || !project) {
        throw app.httpErrors.notFound('Project not found');
      }
      if (project.revision !== body.expectedRevision) {
        throw app.httpErrors.conflict('Project revision conflict');
      }

      const result = await app.services!.projectService.removeMember(
        id,
        userId,
        user,
      );

      if (result === 'forbidden') throw app.httpErrors.forbidden();
      if (result === null) throw app.httpErrors.notFound('Project not found');

      return reply.code(204).send();
    },
  );

  app.post(
    '/api/v1/projects/:id/transfer-owner',
    {
      schema: {
        operationId: 'transferOwner',
        description: 'Transfer project ownership.',
        tags: ['projects'],
        params: Type.Object({ id: UuidSchema }),
        body: TransferOwnerRequestSchema,
        response: {
          200: TransferOwnerResponseSchema,
        },
      },
    },
    async (request) => {
      const user = await currentUser(request.cookies.sessionId);
      if (!user) throw app.httpErrors.unauthorized('Not authenticated');

      const body = request.body as { userId: string; expectedRevision: number };
      const result = await app.services!.projectService.transferOwner(
        (request.params as { id: string }).id,
        body.userId,
        body.expectedRevision,
        user,
      );

      if (result === 'forbidden') throw app.httpErrors.forbidden();
      if (result === 'conflict') {
        throw app.httpErrors.conflict('Project revision conflict');
      }
      if (!result) throw app.httpErrors.notFound('Project not found');

      return { data: result };
    },
  );

  app.post(
    '/api/v1/projects/:id/transitions',
    {
      schema: {
        operationId: 'transitionProject',
        description: 'Transition project status.',
        tags: ['projects'],
        params: Type.Object({ id: UuidSchema }),
        body: ProjectTransitionRequestSchema,
        response: {
          200: ProjectTransitionResponseSchema,
        },
      },
    },
    async (request) => {
      const user = await currentUser(request.cookies.sessionId);
      if (!user) throw app.httpErrors.unauthorized('Not authenticated');

      const body = request.body as ProjectTransitionRequest;
      let result:
        | ProjectContract
        | null
        | 'conflict'
        | 'forbidden'
        | 'invalid_transition'
        | 'precondition_failed';

      if (body.action === 'archive' || body.action === 'restore') {
        result = await app.services!.projectService.transitionArchive(
          (request.params as { id: string }).id,
          body.action,
          body.expectedRevision,
          user,
        );
      } else if (
        body.action === 'start_briefing' ||
        body.action === 'start_designing'
      ) {
        result = await app.services!.projectService.transitionLifecycle(
          (request.params as { id: string }).id,
          body.action,
          body.expectedRevision,
          user,
        );
      } else {
        result = await app.services!.projectService.transitionReview(
          (request.params as { id: string }).id,
          body.action,
          body.comment,
          body.expectedRevision,
          user,
        );
      }

      if (result === 'forbidden') throw app.httpErrors.forbidden();
      if (result === 'conflict')
        throw app.httpErrors.conflict('Project revision conflict');
      if (result === 'invalid_transition')
        throw app.httpErrors.unprocessableEntity('Invalid state transition');
      if (result === 'precondition_failed')
        throw app.httpErrors.unprocessableEntity(
          'Precondition failed: no selected version',
        );
      if (!result) throw app.httpErrors.notFound('Project not found');

      return { data: result };
    },
  );
}
