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
 * 历史背景：journal 中多个 entry 的 when 时间戳小于前面已应用迁移的 when，
 * 导致 Drizzle 迁移器（基于 MAX(created_at) 比较）静默跳过这些迁移。
 * 本函数在调用 drizzleMigrate 之前，将数据库中残留的旧乱序时间戳批量更新为
 * 修正后的值，使后续迁移能正常运行。
 *
 * 策略：按 id ASC 顺序读取所有现有记录，与目标时间戳序列对齐后批量更新，
 * 避免旧值重复（如 idx 5 和 idx 10 旧 when 相同）导致 UPDATE WHERE 歧义。
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

  // 修正后的 journal when 序列（按 idx 升序，与 _journal.json 完全一致）
  const correctedWhens = [
    1789396346356, // idx 0
    1789396346357, // idx 1
    1789396346358, // idx 2
    1789443151716, // idx 3
    1789500000000, // idx 4
    1789500000001, // idx 5  (旧: 1757980800000)
    1789500000002, // idx 6  (旧: 1757980800001)
    1789500000003, // idx 7  (旧: 1757980800002)
    1789500000004, // idx 8  (旧: 1757980800003)
    1789500000005, // idx 9  (旧: 1757980800004)
    1789500000006, // idx 10 (旧: 1757980800000, 与 idx 5 重复)
    1789500000007, // idx 11 (旧: 1789420800000)
    1789500000008, // idx 12
    1789539249154, // idx 13
    1789557992000, // idx 14
    1789561117000, // idx 15
    1789565939000, // idx 16
    1789728000000, // idx 17
    1789728000001, // idx 18 (旧: 1758153600000)
    1789728000002, // idx 19 (旧: 1789643638000)
    1789730000000, // idx 20
    1789730000001, // idx 21 (旧: 1758153600001)
    1789730000002, // idx 22 (旧: 1758240000000)
  ];

  // 按 id ASC 读取现有记录
  const { rows } = await pool.query<{ id: number; created_at: string }>(
    `SELECT id, created_at FROM drizzle.__drizzle_migrations ORDER BY id ASC`,
  );

  // 仅处理已存在的记录数（可能少于 correctedWhens 长度，剩余的由 drizzleMigrate 补录）
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const targetWhen = correctedWhens[i];
    if (row === undefined || targetWhen === undefined) break;

    const currentWhen = Number(row.created_at);
    if (currentWhen !== targetWhen) {
      await pool.query(
        `UPDATE drizzle.__drizzle_migrations SET created_at = $1 WHERE id = $2`,
        [targetWhen, row.id],
      );
    }
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
