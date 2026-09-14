import type { FastifyInstance } from 'fastify';
import {
  ListAuditLogsQuerySchema,
  ListAuditLogsResponseSchema,
} from '@exhibition/contracts';

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
    async () => {
      throw app.httpErrors.notImplemented('List audit logs not implemented');
    },
  );
}
