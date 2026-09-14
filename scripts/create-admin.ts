import { createDatabase } from '@exhibition/db';
import { users } from '@exhibition/db';
import { randomBytes, scrypt } from 'node:crypto';
import { promisify } from 'node:util';

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const derivedKey = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${salt}:${derivedKey.toString('hex')}`;
}

async function createAdminUser() {
  const { pool, db } = createDatabase();

  try {
    const email = process.env.ADMIN_EMAIL || 'admin@exhibition.local';
    const password = process.env.ADMIN_PASSWORD || 'admin123';
    const displayName = process.env.ADMIN_DISPLAY_NAME || 'Administrator';

    console.log(`Creating admin user: ${email}`);

    const passwordHash = await hashPassword(password);

    await db.insert(users).values({
      email,
      displayName,
      passwordHash,
      role: 'admin',
      status: 'enabled',
      mustChangePassword: false,
    });

    console.log('✓ Admin user created successfully');
    console.log(`  Email: ${email}`);
    console.log(`  Password: ${password}`);
    console.log('  Role: admin');
  } catch (error: any) {
    if (error?.code === '23505') {
      console.log('⚠ Admin user already exists');
    } else {
      console.error('✗ Failed to create admin user:', error);
      process.exitCode = 1;
    }
  } finally {
    await pool.end();
  }
}

createAdminUser();
