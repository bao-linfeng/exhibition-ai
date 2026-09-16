import type { FastifyInstance } from 'fastify';
import {
  ListAuditLogsQuerySchema,
  ListAuditLogsResponseSchema,
} from '@exhibition/contracts';
import type { ListAuditLogsQuery } from '@exhibition/contracts';

export async function auditRoutes(app: FastifyInstance) {
  // GET /api/v1/audit-logs
  app.get(
    '/api/v1/audit-logs',
    {
      schema: {
        operationId: 'listAuditLogs',
        description: 'List audit logs (admin only).',
        tags: ['audit'],
        querystring: ListAuditLogsQuerySchema,
        response: {
          200: ListAuditLogsResponseSchema,
        },
      },
    },
    async (request) => {
      const sessionId = request.cookies.sessionId;
      const user = sessionId
        ? await app.services!.authService.validateSession(sessionId)
        : null;
      if (!user) throw app.httpErrors.unauthorized('Not authenticated');
      if (user.role !== 'admin') throw app.httpErrors.forbidden();

      return app.services!.auditService.findAll(
        request.query as ListAuditLogsQuery,
      );
    },
  );
}
