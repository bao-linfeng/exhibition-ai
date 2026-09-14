import type { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import {
  GetConfirmationResponseSchema,
  ApproveConfirmationRequestSchema,
  ApproveConfirmationResponseSchema,
  RejectConfirmationRequestSchema,
  RejectConfirmationResponseSchema,
  UuidSchema,
} from '@exhibition/contracts';

export async function confirmationRoutes(app: FastifyInstance) {
  // GET /api/v1/confirmations/:id
  app.get(
    '/api/v1/confirmations/:id',
    {
      schema: {
        operationId: 'getConfirmation',
        description: 'Get confirmation details.',
        tags: ['confirmations'],
        params: Type.Object({ id: UuidSchema }),
        response: {
          200: GetConfirmationResponseSchema,
        },
      },
    },
    async () => {
      throw app.httpErrors.notImplemented('Get confirmation not implemented');
    },
  );

  // POST /api/v1/confirmations/:id/approve
  app.post(
    '/api/v1/confirmations/:id/approve',
    {
      schema: {
        operationId: 'approveConfirmation',
        description: 'Approve confirmation.',
        tags: ['confirmations'],
        params: Type.Object({ id: UuidSchema }),
        body: ApproveConfirmationRequestSchema,
        response: {
          200: ApproveConfirmationResponseSchema,
        },
      },
    },
    async () => {
      throw app.httpErrors.notImplemented(
        'Approve confirmation not implemented',
      );
    },
  );

  // POST /api/v1/confirmations/:id/reject
  app.post(
    '/api/v1/confirmations/:id/reject',
    {
      schema: {
        operationId: 'rejectConfirmation',
        description: 'Reject confirmation.',
        tags: ['confirmations'],
        params: Type.Object({ id: UuidSchema }),
        body: RejectConfirmationRequestSchema,
        response: {
          200: RejectConfirmationResponseSchema,
        },
      },
    },
    async () => {
      throw app.httpErrors.notImplemented(
        'Reject confirmation not implemented',
      );
    },
  );
}
