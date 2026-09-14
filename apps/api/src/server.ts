import { createServices } from '@exhibition/backend';
import { buildApp } from './app.js';

const app = await buildApp(createServices());
let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  await app.close();
}
process.once('SIGINT', () => {
  void stop();
});
process.once('SIGTERM', () => {
  void stop();
});
try {
  await app.listen({
    host: process.env.HOST ?? '0.0.0.0',
    port: Number(process.env.PORT ?? '3000'),
  });
  console.log('API listening');
} catch {
  console.error(
    'API failed to start; check local configuration and port availability.',
  );
  await stop();
  process.exitCode = 1;
}
