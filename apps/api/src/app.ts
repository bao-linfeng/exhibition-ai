import Fastify from 'fastify';
import swagger from '@fastify/swagger';
import sensible from '@fastify/sensible';
import cookie from '@fastify/cookie';
import { HealthSchema, ReadySchema } from '@exhibition/contracts';
import type { createServices } from '@exhibition/backend';
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

export async function buildApp(services?: ReturnType<typeof createServices>) {
  const app = Fastify({ logger: false });

  // 将 services 附加到 app 实例以便路由访问
  if (services) {
    app.decorate('services', services);
  }

  // Register plugins
  await app.register(sensible);
  await app.register(cookie, {
    secret:
      process.env.COOKIE_SECRET || 'development-secret-change-in-production',
  });
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
      ],
    },
  });

  // Health checks
  app.get(
    '/api/health',
    {
      schema: {
        operationId: 'getHealth',
        description: 'Process liveness.',
        response: { 200: HealthSchema },
      },
    },
    async () => ({ status: 'ok' as const }),
  );
  app.get(
    '/api/ready',
    {
      schema: {
        operationId: 'getReadiness',
        description: 'PostgreSQL, Redis and object storage readiness.',
        response: { 200: ReadySchema, 503: ReadySchema },
      },
    },
    async (_request, reply) => {
      if (!services) throw new Error('Readiness services are unavailable');
      const dependencies = await services.readiness();
      const ready = Object.values(dependencies).every(Boolean);
      return reply
        .code(ready ? 200 : 503)
        .send({ status: ready ? 'ready' : 'not_ready', dependencies });
    },
  );

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

  // Error handler
  app.setErrorHandler((_error, _request, reply) => {
    void reply.code(500).send({ error: 'Internal server error' });
  });

  if (services)
    app.addHook('onClose', async () => {
      await services.close();
    });
  await app.ready();
  return app;
}
