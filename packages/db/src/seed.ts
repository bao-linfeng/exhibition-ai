import { randomBytes, scrypt } from 'node:crypto';
import { promisify } from 'node:util';
import { createDatabase, modelConfigs, users } from './index.js';

const appEnv = process.env.APP_ENV ?? process.env.NODE_ENV;
const allowed =
  (appEnv === 'development' || appEnv === 'test') &&
  process.env.NODE_ENV !== 'production';

if (!allowed) {
  console.error(
    '[seed] Seed is only allowed in development or test environments.',
  );
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

    await db
      .insert(modelConfigs)
      .values([
        {
          providerId: 'mock',
          modelId: 'mock-full',
          displayName: 'Mock Image Model (Full)',
          description: 'Mock 模型，支持文生图和图生图，供开发和测试使用',
          capabilities: ['generate', 'edit'],
          costPerImageMinor: 0,
          currency: 'CNY',
          isActive: true,
          maxConcurrent: 4,
          parametersSchema: {},
        },
        {
          providerId: 'google',
          modelId: 'gemini-3.1-flash-image',
          displayName: 'Gemini 3.1 Flash Image',
          description: 'Google Gemini 原生图片生成模型，支持文生图和图生图',
          capabilities: ['generate', 'edit'],
          costPerImageMinor: 0,
          currency: 'CNY',
          isActive: true,
          maxConcurrent: 2,
          parametersSchema: {},
        },
        {
          providerId: 'google',
          modelId: 'gemini-3.1-flash-lite-image',
          displayName: 'Gemini 3.1 Flash Lite Image',
          description: 'Google Gemini 轻量图片生成模型，支持文生图',
          capabilities: ['generate'],
          costPerImageMinor: 0,
          currency: 'CNY',
          isActive: true,
          maxConcurrent: 2,
          parametersSchema: {},
        },
        {
          providerId: 'google',
          modelId: 'gemini-3-pro-image',
          displayName: 'Gemini 3 Pro Image',
          description: 'Google Gemini 高质量图片生成模型，支持文生图和图生图',
          capabilities: ['generate', 'edit'],
          costPerImageMinor: 0,
          currency: 'CNY',
          isActive: true,
          maxConcurrent: 2,
          parametersSchema: {},
        },
      ])
      .onConflictDoNothing({
        target: [modelConfigs.providerId, modelConfigs.modelId],
      });

    console.log(
      '[seed] Development admin user, mock model, and Google Gemini models seeded',
    );
  } finally {
    await pool.end();
  }
}

seed().catch((error: unknown) => {
  console.error('[seed] Failed to seed database:', error);
  process.exitCode = 1;
});
