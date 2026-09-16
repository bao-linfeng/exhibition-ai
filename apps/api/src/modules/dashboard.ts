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
      const user = await currentUser(request.cookies.sessionId);
      if (!user) throw app.httpErrors.unauthorized('Not authenticated');

      const visibleProjectIds =
        user.role === 'admin'
          ? 'all'
          : await app.services!.projectService.listVisibleProjectIds(user.id);
      return app.services!.dashboardService.getSummary(visibleProjectIds);
    },
  );
}
