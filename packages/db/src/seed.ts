import { randomBytes, scrypt } from 'node:crypto';
import { promisify } from 'node:util';
import { createDatabase, users } from './index.js';

const appEnv = process.env.APP_ENV ?? 'development';

if (appEnv === 'production') {
  console.error('[seed] Seed is not allowed in production');
  process.exit(1);
}

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const derivedKey = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${salt}:${derivedKey.toString('hex')}`;
}

async function seed(): Promise<void> {
  const { pool, db } = createDatabase();

  try {
    const passwordHash = await hashPassword('admin123');

    await db
      .insert(users)
      .values({
        email: 'dev-admin@exhibition.local',
        displayName: 'Dev Admin',
        passwordHash,
        role: 'admin',
        status: 'enabled',
        mustChangePassword: false,
      })
      .onConflictDoNothing({ target: users.email });

    console.log('[seed] Development admin user seeded');
  } finally {
    await pool.end();
  }
}

seed().catch((error: unknown) => {
  console.error('[seed] Failed to seed database:', error);
  process.exitCode = 1;
});
