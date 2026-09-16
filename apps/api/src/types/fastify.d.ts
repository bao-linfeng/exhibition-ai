import 'fastify';
import type {
  createServices,
  DashboardService,
  ActorContext,
  ProjectPolicy,
} from '@exhibition/backend';

declare module 'fastify' {
  interface FastifyInstance {
    services?: ReturnType<typeof createServices> & {
      dashboardService: DashboardService;
    };
    projectPolicy?: ProjectPolicy;
  }

  interface FastifyRequest {
    actorContext?: ActorContext;
  }
}
