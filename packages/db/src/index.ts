import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate as drizzleMigrate } from 'drizzle-orm/node-postgres/migrator';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import * as schema from './schema/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export * from './schema/index.js';

export function createDatabase() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is required');
  }

  const pool = new pg.Pool({
    connectionString,
    max: 5,
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 10000,
  });

  pool.on('error', () => {
    /* A later readiness probe reports lost database connectivity. */
  });

  const db = drizzle(pool, { schema });

  return { pool, db };
}

export function createDrizzle(pool: pg.Pool) {
  return drizzle(pool, { schema });
}

export type Database = ReturnType<typeof createDatabase>['db'];

export async function migrate() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is required');
  }

  const pool = new pg.Pool({ connectionString });
  const db = drizzle(pool);

  try {
    // 确保扩展存在
    await pool.query('CREATE EXTENSION IF NOT EXISTS vector');

    // 执行迁移
    const migrationsFolder = join(__dirname, '../migrations');
    await drizzleMigrate(db, { migrationsFolder });
  } finally {
    await pool.end();
  }
}
