import 'fastify';
import type { createServices } from '@exhibition/backend';

declare module 'fastify' {
  interface FastifyInstance {
    services?: ReturnType<typeof createServices>;
  }
}
