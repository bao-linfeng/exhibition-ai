import 'fastify';
import type { createServices, DashboardService } from '@exhibition/backend';

declare module 'fastify' {
  interface FastifyInstance {
    services?: ReturnType<typeof createServices> & {
      dashboardService: DashboardService;
    };
  }
}
