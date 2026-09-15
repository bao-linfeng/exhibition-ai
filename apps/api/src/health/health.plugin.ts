import fp from 'fastify-plugin';
import type { FastifyPluginAsync } from 'fastify';
import { HealthSchema, ReadySchema } from '@exhibition/contracts';

const healthPlugin: FastifyPluginAsync = async (app) => {
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
      const services = app.services;
      if (!services) {
        return reply.code(503).send({
          status: 'not_ready' as const,
          dependencies: { postgres: false, redis: false, storage: false },
        });
      }

      const dependencies = await services.readiness();
      const ready = Object.values(dependencies).every(Boolean);
      return reply
        .code(ready ? 200 : 503)
        .send({ status: ready ? 'ready' : 'not_ready', dependencies });
    },
  );
};

export default fp(healthPlugin);
