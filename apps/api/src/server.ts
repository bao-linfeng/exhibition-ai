import { createServices, env, logger } from '@exhibition/backend';
import { buildApp } from './app.js';

const app = await buildApp(createServices());
let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  await app.close();
}
process.once('SIGINT', () => {
  void stop().catch((error) => {
    logger.fatal({ err: error }, 'Graceful shutdown failed');
    process.exitCode = 1;
  });
});
process.once('SIGTERM', () => {
  void stop().catch((error) => {
    logger.fatal({ err: error }, 'Graceful shutdown failed');
    process.exitCode = 1;
  });
});
try {
  await app.listen({ host: env.HOST, port: env.PORT });
} catch (error) {
  logger.fatal({ err: error }, 'API failed to start');
  await stop();
  process.exitCode = 1;
}
