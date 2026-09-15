import type { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import {
  ListCustomersQuerySchema,
  ListCustomersResponseSchema,
  CreateCustomerRequestSchema,
  CreateCustomerResponseSchema,
  GetCustomerResponseSchema,
  UpdateCustomerRequestSchema,
  UpdateCustomerResponseSchema,
  UuidSchema,
} from '@exhibition/contracts';
import type {
  CreateCustomerRequest,
  UpdateCustomerRequest,
} from '@exhibition/contracts';

export async function customerRoutes(app: FastifyInstance) {
  async function currentUser(sessionId: string | undefined) {
    return sessionId
      ? app.services!.authService.validateSession(sessionId)
      : null;
  }

  app.get(
    '/api/v1/customers',
    {
      schema: {
        operationId: 'listCustomers',
        description: 'List customers with filtering.',
        tags: ['customers'],
        querystring: ListCustomersQuerySchema,
        response: {
          200: ListCustomersResponseSchema,
        },
      },
    },
    async (request, _reply) => {
      const user = await currentUser(request.cookies.sessionId);
      if (!user) throw app.httpErrors.unauthorized('Not authenticated');

      const result = await app.services!.customerService.listCustomers(
        request.query as {
          status?: 'active' | 'inactive';
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
    '/api/v1/customers',
    {
      schema: {
        operationId: 'createCustomer',
        description: 'Create a new customer.',
        tags: ['customers'],
        body: CreateCustomerRequestSchema,
        response: {
          201: CreateCustomerResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const user = await currentUser(request.cookies.sessionId);
      if (!user) throw app.httpErrors.unauthorized('Not authenticated');

      const customer = await app.services!.customerService.createCustomer(
        request.body as CreateCustomerRequest,
        user.id,
        user,
      );

      if (customer === 'forbidden') throw app.httpErrors.forbidden();
      return reply.code(201).send({ data: customer });
    },
  );

  app.get(
    '/api/v1/customers/:id',
    {
      schema: {
        operationId: 'getCustomer',
        description: 'Get customer details.',
        tags: ['customers'],
        params: Type.Object({ id: UuidSchema }),
        response: {
          200: GetCustomerResponseSchema,
        },
      },
    },
    async (request) => {
      const user = await currentUser(request.cookies.sessionId);
      if (!user) throw app.httpErrors.unauthorized('Not authenticated');

      const customer = await app.services!.customerService.getCustomer(
        (request.params as { id: string }).id,
        user,
      );

      if (customer === 'forbidden') throw app.httpErrors.forbidden();
      if (!customer) throw app.httpErrors.notFound('Customer not found');

      return { data: customer };
    },
  );

  app.patch(
    '/api/v1/customers/:id',
    {
      schema: {
        operationId: 'updateCustomer',
        description: 'Update customer details.',
        tags: ['customers'],
        params: Type.Object({ id: UuidSchema }),
        body: UpdateCustomerRequestSchema,
        response: {
          200: UpdateCustomerResponseSchema,
        },
      },
    },
    async (request) => {
      const user = await currentUser(request.cookies.sessionId);
      if (!user) throw app.httpErrors.unauthorized('Not authenticated');

      const body = request.body as UpdateCustomerRequest;
      const result = await app.services!.customerService.updateCustomer(
        (request.params as { id: string }).id,
        body,
        body.expectedRevision,
        user,
      );

      if (result === 'forbidden') throw app.httpErrors.forbidden();
      if (result === 'conflict') {
        throw app.httpErrors.conflict('Customer revision conflict');
      }
      if (!result) throw app.httpErrors.notFound('Customer not found');

      return { data: result };
    },
  );
}
