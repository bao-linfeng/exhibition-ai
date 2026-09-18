/**
 * 幂等管理员初始化脚本。
 * 通过环境变量传入密码，不输出到日志。
 * 用法：ADMIN_EMAIL=x@example.com ADMIN_PASSWORD=<secret> pnpm user:bootstrap
 */
import { createDatabase, users } from '@exhibition/db';
import { randomBytes, scrypt } from 'node:crypto';
import { promisify } from 'node:util';

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const derivedKey = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${salt}:${derivedKey.toString('hex')}`;
}

async function bootstrap(): Promise<void> {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  const displayName = process.env.ADMIN_DISPLAY_NAME ?? 'Administrator';

  if (!email || !password) {
    console.error(
      '[bootstrap] ADMIN_EMAIL and ADMIN_PASSWORD are required environment variables.',
    );
    process.exit(1);
  }

  if (password.length < 12) {
    console.error(
      '[bootstrap] ADMIN_PASSWORD must be at least 12 characters.',
    );
    process.exit(1);
  }

  const { pool, db } = createDatabase();

  try {
    const passwordHash = await hashPassword(password);

    const result = await db
      .insert(users)
      .values({
        email,
        displayName,
        passwordHash,
        role: 'admin',
        status: 'enabled',
        mustChangePassword: true,
      })
      .onConflictDoNothing({ target: users.email })
      .returning({ id: users.id, email: users.email });

    if (result.length > 0) {
      console.log(`[bootstrap] Admin user created: ${email}`);
      console.log('[bootstrap] mustChangePassword=true — user must set a new password on first login.');
    } else {
      console.log(`[bootstrap] Admin user already exists (${email}), skipping.`);
    }
  } finally {
    await pool.end();
  }
}

bootstrap().catch((error: unknown) => {
  console.error('[bootstrap] Failed:', error);
  process.exitCode = 1;
});
