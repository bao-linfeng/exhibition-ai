import Fastify, {
  type FastifyInstance,
  type RawReplyDefaultExpression,
  type RawRequestDefaultExpression,
  type RawServerDefault,
} from 'fastify';
import swagger from '@fastify/swagger';
import sensible from '@fastify/sensible';
import cookie from '@fastify/cookie';
import { env, logger, type createServices, ProjectPolicy } from '@exhibition/backend';
import { errorHandlerPlugin } from './plugins/error-handler.js';
import healthPlugin from './health/health.plugin.js';
import { authRoutes } from './modules/auth.js';
import { userRoutes } from './modules/users.js';
import { customerRoutes } from './modules/customers.js';
import { projectRoutes } from './modules/projects.js';
import { briefRoutes } from './modules/briefs.js';
import { assetRoutes } from './modules/assets.js';
import { generationRoutes } from './modules/generations.js';
import { versionRoutes } from './modules/versions.js';
import { directionRoutes } from './modules/directions.js';
import { taskRoutes } from './modules/tasks.js';
import { conversationRoutes } from './modules/conversations.js';
import { confirmationRoutes } from './modules/confirmations.js';
import { exportRoutes } from './modules/exports.js';
import { auditRoutes } from './modules/audit.js';
import { modelRoutes } from './modules/models.js';
import { eventRoutes } from './modules/events.js';
import { dashboardRoutes } from './modules/dashboard.js';
import { settingsRoutes } from './modules/settings.js';
import { realTimeRoutes } from './realtime/sse.routes.js';

export async function buildApp(
  services?: ReturnType<typeof createServices>,
): Promise<
  FastifyInstance<
    RawServerDefault,
    RawRequestDefaultExpression<RawServerDefault>,
    RawReplyDefaultExpression<RawServerDefault>,
    typeof logger
  >
> {
  const app = Fastify({ loggerInstance: logger });

  // 将 services 附加到 app 实例以便路由访问
  if (services) {
    app.decorate('services', services);
    app.decorate('projectPolicy', new ProjectPolicy(services.pool));
  }

  // Register plugins
  await app.register(errorHandlerPlugin);
  await app.register(sensible);
  await app.register(cookie, { secret: env.COOKIE_SECRET });
  await app.register(swagger, {
    openapi: {
      openapi: '3.0.3',
      info: { title: 'Exhibition AI API', version: '0.1.0' },
      tags: [
        { name: 'auth', description: 'Authentication and user session' },
        { name: 'users', description: 'User management' },
        { name: 'customers', description: 'Customer management' },
        { name: 'projects', description: 'Project management' },
        { name: 'briefs', description: 'Project brief and requirements' },
        { name: 'assets', description: 'Asset upload and management' },
        { name: 'generations', description: 'Image generation tasks' },
        { name: 'versions', description: 'Image version management' },
        { name: 'directions', description: 'Design directions' },
        { name: 'tasks', description: 'Asynchronous task management' },
        { name: 'conversations', description: 'Agent conversations' },
        { name: 'confirmations', description: 'User confirmations' },
        { name: 'exports', description: 'Export tasks' },
        { name: 'audit', description: 'Audit logs' },
        { name: 'models', description: 'AI model information' },
        { name: 'events', description: 'Real-time events' },
        { name: 'dashboard', description: 'Dashboard summary' },
        { name: 'settings', description: 'Model configurations and quotas' },
      ],
    },
  });

  await app.register(healthPlugin);

  // Register API routes
  await app.register(authRoutes);
  await app.register(userRoutes);
  await app.register(customerRoutes);
  await app.register(projectRoutes);
  await app.register(briefRoutes);
  await app.register(assetRoutes);
  await app.register(generationRoutes);
  await app.register(versionRoutes);
  await app.register(directionRoutes);
  await app.register(taskRoutes);
  await app.register(conversationRoutes);
  await app.register(confirmationRoutes);
  await app.register(exportRoutes);
  await app.register(auditRoutes);
  await app.register(modelRoutes);
  await app.register(eventRoutes);
  await app.register(dashboardRoutes);
  await app.register(settingsRoutes);

  // Register SSE routes
  if (services) {
    await app.register(realTimeRoutes, { eventsService: services.eventsService });
  }

  if (services)
    app.addHook('onClose', async () => {
      await services.close();
    });
  await app.ready();
  return app;
}
