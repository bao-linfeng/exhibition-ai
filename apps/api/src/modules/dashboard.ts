import type { FastifyInstance } from 'fastify';
import { DashboardSummaryResponseSchema } from '@exhibition/contracts';

export async function dashboardRoutes(app: FastifyInstance) {
  async function currentUser(sessionId: string | undefined) {
    return sessionId
      ? app.services!.authService.validateSession(sessionId)
      : null;
  }

  app.get(
    '/api/v1/dashboard/summary',
    {
      schema: {
        operationId: 'getDashboardSummary',
        description: 'Get the current user dashboard project summary.',
        tags: ['dashboard'],
        response: { 200: DashboardSummaryResponseSchema },
      },
    },
    async (request) => {
      if (!(await currentUser(request.cookies.sessionId)))
        throw app.httpErrors.unauthorized('Not authenticated');
      return app.services!.dashboardService.getSummary();
    },
  );
}
