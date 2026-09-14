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
import type { CreateProjectRequest, ProjectTransitionRequest, UpdateProjectRequest } from '@exhibition/contracts';

export async function projectRoutes(app: FastifyInstance) {
  if (!app.services) throw new Error('Services not initialized');
  const services = app.services;

  async function currentUser(sessionId: string | undefined) {
    return sessionId ? services.authService.validateSession(sessionId) : null;
  }
  // GET /api/v1/projects
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
      if (!(await currentUser(request.cookies.sessionId))) throw app.httpErrors.unauthorized('Not authenticated');
      return services.projectService.listProjects(request.query as { status?: 'draft' | 'briefing' | 'designing' | 'reviewing' | 'approved' | 'archived'; customerId?: string; ownerId?: string; search?: string; cursor?: string; limit?: number });
    },
  );

  // POST /api/v1/projects
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
      const project = await services.projectService.createProject(request.body as CreateProjectRequest, user.id);
      return reply.code(201).send({ data: project });
    },
  );

  // GET /api/v1/projects/:id
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
      if (!(await currentUser(request.cookies.sessionId))) throw app.httpErrors.unauthorized('Not authenticated');
      const project = await services.projectService.getProject((request.params as { id: string }).id);
      if (!project) throw app.httpErrors.notFound('Project not found');
      return { data: project };
    },
  );

  // PATCH /api/v1/projects/:id
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
      if (!(await currentUser(request.cookies.sessionId))) throw app.httpErrors.unauthorized('Not authenticated');
      const body = request.body as UpdateProjectRequest;
      const result = await services.projectService.updateProject((request.params as { id: string }).id, body, body.expectedRevision);
      if (result === 'conflict') throw app.httpErrors.conflict('Project revision conflict');
      if (!result) throw app.httpErrors.notFound('Project not found');
      return { data: result };
    },
  );

  // GET /api/v1/projects/:id/members
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
      if (!(await currentUser(request.cookies.sessionId))) throw app.httpErrors.unauthorized('Not authenticated');
      const { id } = request.params as { id: string };
      if (!(await services.projectService.getProject(id))) throw app.httpErrors.notFound('Project not found');
      return { data: await services.projectService.listMembers(id) };
    },
  );

  // POST /api/v1/projects/:id/members
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
      if (!(await services.projectService.getProject(id))) throw app.httpErrors.notFound('Project not found');
      const member = await services.projectService.addMember(id, body.userId, user.id);
      if (!member) throw app.httpErrors.conflict('Project member already exists');
      return reply.code(201).send({ data: member });
    },
  );

  // DELETE /api/v1/projects/:id/members/:userId
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
      if (!(await currentUser(request.cookies.sessionId))) throw app.httpErrors.unauthorized('Not authenticated');
      const { id, userId } = request.params as { id: string; userId: string };
      const body = request.body as { expectedRevision: number };
      const project = await services.projectService.getProject(id);
      if (!project) throw app.httpErrors.notFound('Project not found');
      if (project.revision !== body.expectedRevision) throw app.httpErrors.conflict('Project revision conflict');
      await services.projectService.removeMember(id, userId);
      return reply.code(204).send();
    },
  );

  // POST /api/v1/projects/:id/transfer-owner
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
      if (!(await currentUser(request.cookies.sessionId))) throw app.httpErrors.unauthorized('Not authenticated');
      const body = request.body as { userId: string; expectedRevision: number };
      const result = await services.projectService.transferOwner((request.params as { id: string }).id, body.userId, body.expectedRevision);
      if (result === 'conflict') throw app.httpErrors.conflict('Project revision conflict');
      if (!result) throw app.httpErrors.notFound('Project not found');
      return { data: result };
    },
  );

  // POST /api/v1/projects/:id/transitions
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
      if (!(await currentUser(request.cookies.sessionId))) throw app.httpErrors.unauthorized('Not authenticated');
      const body = request.body as ProjectTransitionRequest;
      if (body.action !== 'archive' && body.action !== 'restore') {
        throw app.httpErrors.notImplemented('Project transition not implemented');
      }
      const result = await services.projectService.transitionArchive((request.params as { id: string }).id, body.action, body.expectedRevision);
      if (result === 'conflict') throw app.httpErrors.conflict('Project revision conflict');
      if (!result) throw app.httpErrors.notFound('Project not found');
      return { data: result };
    },
  );
}
