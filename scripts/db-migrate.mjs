import { migrate } from '@exhibition/db';

try {
  console.log('Running migrations...');
  await migrate();
  console.log('✓ Migrations completed successfully');
} catch (error) {
  console.error('✗ Migration failed:', error);
  process.exitCode = 1;
}
