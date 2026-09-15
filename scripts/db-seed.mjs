import { createDatabase } from '@exhibition/db';

const appEnv = process.env.APP_ENV ?? process.env.NODE_ENV ?? 'development';

if (appEnv === 'production') {
  console.error(
    '[seed] Seed is not allowed in production (APP_ENV=production).',
  );
  process.exitCode = 1;
  process.exit(1);
}

console.log(`[seed] Running seed in ${appEnv} environment...`);

const { db, pool } = createDatabase();

try {
  // 导入 schema（使用动态 import 确保 dev conditions 生效）
  const { users } = await import('@exhibition/db');

  // 检查是否已有管理员用户，避免重复 seed
  const existing = await db.select({ id: users.id }).from(users).limit(1);
  if (existing.length > 0) {
    console.log('[seed] Database already has users, skipping seed.');
    process.exit(0);
  }

  // Dev/test seed：暂无初始数据需要插入
  // 各业务 Issue 会在其 seed 中追加自己的测试数据
  // 管理员账号通过 scripts/create-admin.ts 受控创建
  console.log(
    '[seed] No seed data configured yet. Use scripts/create-admin.ts to bootstrap admin.',
  );
} catch (error) {
  console.error('[seed] Seed failed:', error);
  process.exitCode = 1;
} finally {
  await pool.end();
}
