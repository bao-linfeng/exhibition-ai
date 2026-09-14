import type { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import {
  ListUsersQuerySchema,
  ListUsersResponseSchema,
  GetUserResponseSchema,
  UpdateUserRequestSchema,
  UpdateUserResponseSchema,
  ListUserOptionsQuerySchema,
  ListUserOptionsResponseSchema,
  UuidSchema,
} from '@exhibition/contracts';
import type { ListUsersQuery, UpdateUserRequest } from '@exhibition/contracts';

export async function userRoutes(app: FastifyInstance) {
  if (!app.services) throw new Error('Services not initialized');
  const services = app.services;

  async function currentUser(sessionId: string | undefined) {
    return sessionId ? services.authService.validateSession(sessionId) : null;
  }
  // GET /api/v1/users
  app.get(
    '/api/v1/users',
    {
      schema: {
        operationId: 'listUsers',
        description: 'List users (admin only).',
        tags: ['users'],
        querystring: ListUsersQuerySchema,
        response: {
          200: ListUsersResponseSchema,
        },
      },
    },
    async (request) => {
      const user = await currentUser(request.cookies.sessionId);
      if (!user) throw app.httpErrors.unauthorized('Not authenticated');
      const result = await services.userService.listUsers(request.query as ListUsersQuery, user);
      if (result === 'forbidden') throw app.httpErrors.forbidden('Administrator access required');
      return result;
    },
  );

  // GET /api/v1/users/:id
  app.get(
    '/api/v1/users/:id',
    {
      schema: {
        operationId: 'getUser',
        description: 'Get user details.',
        tags: ['users'],
        params: Type.Object({ id: UuidSchema }),
        response: {
          200: GetUserResponseSchema,
        },
      },
    },
    async (request) => {
      const user = await currentUser(request.cookies.sessionId);
      if (!user) throw app.httpErrors.unauthorized('Not authenticated');
      const result = await services.userService.getUser((request.params as { id: string }).id, user);
      if (result === 'forbidden') throw app.httpErrors.forbidden('Administrator access required');
      if (!result) throw app.httpErrors.notFound('User not found');
      return { data: result };
    },
  );

  // PATCH /api/v1/users/:id
  app.patch(
    '/api/v1/users/:id',
    {
      schema: {
        operationId: 'updateUser',
        description: 'Update user role/status (admin only).',
        tags: ['users'],
        params: Type.Object({ id: UuidSchema }),
        body: UpdateUserRequestSchema,
        response: {
          200: UpdateUserResponseSchema,
        },
      },
    },
    async (request) => {
      const user = await currentUser(request.cookies.sessionId);
      if (!user) throw app.httpErrors.unauthorized('Not authenticated');
      const result = await services.userService.updateUser((request.params as { id: string }).id, request.body as UpdateUserRequest, user);
      if (result === 'forbidden') throw app.httpErrors.forbidden('Administrator access required');
      if (result === 'conflict') throw app.httpErrors.conflict('User revision conflict');
      if (!result) throw app.httpErrors.notFound('User not found');
      return { data: result };
    },
  );

  // GET /api/v1/users/options
  app.get(
    '/api/v1/users/options',
    {
      schema: {
        operationId: 'listUserOptions',
        description: 'Get user options for member assignment.',
        tags: ['users'],
        querystring: ListUserOptionsQuerySchema,
        response: {
          200: ListUserOptionsResponseSchema,
        },
      },
    },
    async (request) => {
      const user = await currentUser(request.cookies.sessionId);
      if (!user) throw app.httpErrors.unauthorized('Not authenticated');
      const query = request.query as { search?: string; limit?: number };
      const result = await services.userService.listOptions(query.search, query.limit, user);
      if (result === 'forbidden') throw app.httpErrors.forbidden('Administrator access required');
      return { data: result };
    },
  );
}
