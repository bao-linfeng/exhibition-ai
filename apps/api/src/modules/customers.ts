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
import type { CreateCustomerRequest, UpdateCustomerRequest } from '@exhibition/contracts';

export async function customerRoutes(app: FastifyInstance) {
  if (!app.services) throw new Error('Services not initialized');
  const services = app.services;

  async function currentUser(sessionId: string | undefined) {
    return sessionId ? services.authService.validateSession(sessionId) : null;
  }
  // GET /api/v1/customers
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
    async (request, reply) => {
      if (!(await currentUser(request.cookies.sessionId))) throw app.httpErrors.unauthorized('Not authenticated');
      return services.customerService.listCustomers(request.query as { status?: 'active' | 'inactive'; search?: string; cursor?: string; limit?: number });
    },
  );

  // POST /api/v1/customers
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
      const customer = await services.customerService.createCustomer(request.body as CreateCustomerRequest, user.id);
      return reply.code(201).send({ data: customer });
    },
  );

  // GET /api/v1/customers/:id
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
      if (!(await currentUser(request.cookies.sessionId))) throw app.httpErrors.unauthorized('Not authenticated');
      const customer = await services.customerService.getCustomer((request.params as { id: string }).id);
      if (!customer) throw app.httpErrors.notFound('Customer not found');
      return { data: customer };
    },
  );

  // PATCH /api/v1/customers/:id
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
      if (!(await currentUser(request.cookies.sessionId))) throw app.httpErrors.unauthorized('Not authenticated');
      const body = request.body as UpdateCustomerRequest;
      const result = await services.customerService.updateCustomer((request.params as { id: string }).id, body, body.expectedRevision);
      if (result === 'conflict') throw app.httpErrors.conflict('Customer revision conflict');
      if (!result) throw app.httpErrors.notFound('Customer not found');
      return { data: result };
    },
  );
}
