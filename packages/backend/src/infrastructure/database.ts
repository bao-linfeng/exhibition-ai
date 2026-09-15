import { createDatabase, type Database } from '@exhibition/db';

type Pool = ReturnType<typeof createDatabase>['pool'];
type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0];

let pool: Pool | undefined;
let db: Database | undefined;

export function initDatabase(): { pool: Pool; db: Database } {
  if (pool && db) return { pool, db };

  const database = createDatabase();
  pool = database.pool;
  db = database.db;
  return { pool, db };
}

export function getDb(): Database {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return db;
}

export function getPool(): Pool {
  if (!pool) {
    throw new Error(
      'Database pool not initialized. Call initDatabase() first.',
    );
  }
  return pool;
}

export async function withTransaction<T>(
  fn: (tx: Transaction) => Promise<T>,
): Promise<T> {
  return getDb().transaction(fn);
}

export async function closeDatabase(): Promise<void> {
  const currentPool = pool;
  if (!currentPool) return;

  pool = undefined;
  db = undefined;

  await currentPool.end();
}
