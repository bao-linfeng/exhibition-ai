import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate as drizzleMigrate } from 'drizzle-orm/node-postgres/migrator';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { readFileSync } from 'node:fs';
import * as schema from './schema/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export * from './schema/index.js';
export { schema };

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

/**
 * 读取 journal 文件，返回所有条目的 { idx, when, tag } 列表，按 idx 升序排列。
 */
function readJournalEntries(): { idx: number; when: number; tag: string }[] {
  const journalPath = join(__dirname, '../migrations/meta/_journal.json');
  const journal = JSON.parse(readFileSync(journalPath, 'utf-8')) as {
    entries: { idx: number; when: number; tag: string }[];
  };
  return [...journal.entries].sort((a, b) => a.idx - b.idx);
}

/**
 * 验证 journal 中所有 when 值是否严格单调递增。
 * 若发现乱序，抛出错误，防止静默跳过。
 */
function assertJournalMonotonic(
  entries: { idx: number; when: number; tag: string }[],
): void {
  for (let i = 1; i < entries.length; i++) {
    const cur = entries[i]!;
    const prev = entries[i - 1]!;
    if (cur.when <= prev.when) {
      throw new Error(
        `Migration journal 时间戳乱序：idx ${cur.idx} (${cur.tag}) 的 when=${cur.when} 不大于 idx ${prev.idx} (${prev.tag}) 的 when=${prev.when}。` +
          `请修正 packages/db/migrations/meta/_journal.json 中的时间戳，确保严格单调递增。`,
      );
    }
  }
}

/**
 * 修复已有数据库中因 journal 时间戳乱序而导致的 __drizzle_migrations 记录问题。
 *
 * 历史背景：journal 中 idx 18/21/22 的 when 时间戳曾小于 idx 17 的 when，
 * 导致 Drizzle 迁移器（基于 MAX(created_at) 比较）静默跳过这些迁移。
 * 本函数在调用 drizzleMigrate 之前，将数据库中残留的旧乱序时间戳更新为
 * 修正后的值，使后续迁移能正常运行。
 *
 * 映射表：旧 when → 新 when（与 _journal.json 中的修正值对应）
 */
async function repairOutOfOrderMigrationTimestamps(
  pool: pg.Pool,
): Promise<void> {
  // 确保 drizzle schema 和迁移表存在，若不存在则跳过（全新数据库无需修复）
  const schemaExists = await pool
    .query(
      `SELECT 1 FROM information_schema.schemata WHERE schema_name = 'drizzle'`,
    )
    .then((r) => (r.rowCount ?? 0) > 0)
    .catch(() => false);

  if (!schemaExists) return;

  const tableExists = await pool
    .query(
      `SELECT 1 FROM information_schema.tables
       WHERE table_schema = 'drizzle' AND table_name = '__drizzle_migrations'`,
    )
    .then((r) => (r.rowCount ?? 0) > 0)
    .catch(() => false);

  if (!tableExists) return;

  // 旧（错误）时间戳 → 新（修正）时间戳的映射
  // 这些是 _journal.json 修正前后的对应值
  const timestampFixes: [oldWhen: number, newWhen: number][] = [
    [1758153600000, 1789728000001], // idx 18: 0018_add_prompt_templates
    [1789643638000, 1789728000002], // idx 19: 0019_add_favorites_and_tags
    [1758153600001, 1789730000001], // idx 21: 0021_confirmation_processing_failed_status
    [1758240000000, 1789730000002], // idx 22: 0022_add_reconciling_at_to_tasks
  ];

  for (const [oldWhen, newWhen] of timestampFixes) {
    await pool.query(
      `UPDATE drizzle.__drizzle_migrations SET created_at = $1 WHERE created_at = $2`,
      [newWhen, oldWhen],
    );
  }
}

/**
 * 迁移完成后，校验数据库中已记录的迁移条数是否与 journal 条目数一致。
 * 若不一致，说明存在被跳过的迁移，抛出错误。
 */
async function assertAllMigrationsApplied(
  pool: pg.Pool,
  journalEntries: { idx: number; when: number; tag: string }[],
): Promise<void> {
  const result = await pool.query<{ count: string }>(
    `SELECT COUNT(*) as count FROM drizzle.__drizzle_migrations`,
  );
  const appliedCount = parseInt(result.rows[0]?.count ?? '0', 10);
  const expectedCount = journalEntries.length;

  if (appliedCount !== expectedCount) {
    throw new Error(
      `迁移完整性校验失败：journal 包含 ${expectedCount} 条迁移，但数据库中只有 ${appliedCount} 条记录。` +
        `可能存在被静默跳过的迁移，请检查 packages/db/migrations/meta/_journal.json 中的时间戳顺序。`,
    );
  }
}

export async function migrate() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is required');
  }

  // 在连接数据库之前，先在本地验证 journal 时间戳单调性
  const journalEntries = readJournalEntries();
  assertJournalMonotonic(journalEntries);

  const pool = new pg.Pool({ connectionString });
  const db = drizzle(pool);

  try {
    // 确保扩展存在
    await pool.query('CREATE EXTENSION IF NOT EXISTS vector');

    // 修复已有数据库中因历史时间戳乱序导致的记录问题（升级路径）
    await repairOutOfOrderMigrationTimestamps(pool);

    // 执行迁移
    const migrationsFolder = join(__dirname, '../migrations');
    await drizzleMigrate(db, { migrationsFolder });

    // 迁移后校验：确保所有 journal 条目均已应用，无静默跳过
    await assertAllMigrationsApplied(pool, journalEntries);
  } finally {
    await pool.end();
  }
}
