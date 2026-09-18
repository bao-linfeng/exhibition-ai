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
import type {
  ApproveConfirmationRequest,
  RejectConfirmationRequest,
} from '@exhibition/contracts';

function toConfirmationDto(row: {
  id: string;
  runId: string;
  projectId: string;
  requestedBy: string;
  action: string;
  payload: unknown;
  payloadHash: string;
  estimatedFeeMinor: number | null;
  currency: string | null;
  status: string;
  resultTaskId: string | null;
  resultBriefRevisionId: string | null;
  expiresAt: Date;
  createdAt: Date;
}) {
  return {
    id: row.id,
    runId: row.runId,
    projectId: row.projectId,
    requestedBy: row.requestedBy,
    action: row.action,
    payload: row.payload,
    payloadHash: row.payloadHash,
    estimatedFee:
      row.estimatedFeeMinor != null && row.currency != null
        ? { maxAmountMinor: row.estimatedFeeMinor, currency: row.currency }
        : undefined,
    status: row.status,
    resultTaskId: row.resultTaskId,
    resultBriefRevisionId: row.resultBriefRevisionId,
    expiresAt: row.expiresAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
  };
}

export async function confirmationRoutes(app: FastifyInstance) {
  async function currentUser(sessionId: string | undefined) {
    return sessionId
      ? app.services!.authService.validateSession(sessionId)
      : null;
  }

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
    async (request) => {
      const user = await currentUser(request.cookies.sessionId);
      if (!user) throw app.httpErrors.unauthorized('Not authenticated');
      const actorContext = { userId: user.id, role: user.role };

      const { id } = request.params as { id: string };
      const confirmation =
        await app.services!.conversationService.findConfirmationById(id);
      if (!confirmation) {
        throw app.httpErrors.notFound('Confirmation not found');
      }
      if (!app.projectPolicy) {
        throw app.httpErrors.internalServerError(
          'Project policy not initialized',
        );
      }
      if (
        !(await app.projectPolicy.canViewProject(
          actorContext,
          confirmation.projectId,
        ))
      ) {
        throw app.httpErrors.notFound('Confirmation not found');
      }

      return { data: toConfirmationDto(confirmation) };
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
    async (request) => {
      const user = await currentUser(request.cookies.sessionId);
      if (!user) throw app.httpErrors.unauthorized('Not authenticated');
      const actorContext = { userId: user.id, role: user.role };

      const { id } = request.params as { id: string };
      const body = request.body as ApproveConfirmationRequest;
      const confirmation =
        await app.services!.conversationService.findConfirmationById(id);
      if (!confirmation) {
        throw app.httpErrors.notFound('Confirmation not found');
      }
      if (!app.projectPolicy) {
        throw app.httpErrors.internalServerError(
          'Project policy not initialized',
        );
      }
      if (
        !(await app.projectPolicy.canViewProject(
          actorContext,
          confirmation.projectId,
        ))
      ) {
        throw app.httpErrors.notFound('Confirmation not found');
      }

      const result =
        await app.services!.conversationService.approveConfirmation(
          id,
          confirmation.projectId,
          actorContext.userId,
          body.payloadHash,
        );
      if (result === 'not_found') {
        throw app.httpErrors.notFound('Confirmation not found');
      }
      if (result === 'forbidden') throw app.httpErrors.forbidden();
      if (result === 'not_pending') {
        throw app.httpErrors.conflict('Confirmation is not pending');
      }
      if (result === 'hash_mismatch') {
        throw app.httpErrors.conflict('Confirmation payload hash mismatch');
      }
      if (result === 'expired') {
        throw app.httpErrors.gone('Confirmation has expired');
      }

      return { data: result };
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
    async (request) => {
      const user = await currentUser(request.cookies.sessionId);
      if (!user) throw app.httpErrors.unauthorized('Not authenticated');
      const actorContext = { userId: user.id, role: user.role };

      const { id } = request.params as { id: string };
      const body = request.body as RejectConfirmationRequest;
      const confirmation =
        await app.services!.conversationService.findConfirmationById(id);
      if (!confirmation) {
        throw app.httpErrors.notFound('Confirmation not found');
      }
      if (!app.projectPolicy) {
        throw app.httpErrors.internalServerError(
          'Project policy not initialized',
        );
      }
      if (
        !(await app.projectPolicy.canViewProject(
          actorContext,
          confirmation.projectId,
        ))
      ) {
        throw app.httpErrors.notFound('Confirmation not found');
      }

      const result = await app.services!.conversationService.rejectConfirmation(
        id,
        confirmation.projectId,
        actorContext.userId,
        body.reason,
      );
      if (result === 'not_found') {
        throw app.httpErrors.notFound('Confirmation not found');
      }
      if (result === 'forbidden') throw app.httpErrors.forbidden();
      if (result === 'not_pending') {
        throw app.httpErrors.conflict('Confirmation is not pending');
      }

      return { data: { confirmationId: id, status: 'rejected' as const } };
    },
  );
}
