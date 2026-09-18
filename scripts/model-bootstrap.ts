/**
 * 幂等模型配置初始化脚本。
 * 仅插入缺失的模型记录，已存在的记录保持不变（不覆盖管理员调整的参数）。
 * 用法：pnpm model:bootstrap
 */
import { createDatabase, modelConfigs } from '@exhibition/db';

const MOCK_MODELS = [
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
] as const;

const REAL_MODELS = [
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
] as const;

async function bootstrap(): Promise<void> {
  const providerMode = process.env.AI_PROVIDER_MODE ?? 'mock';
  const models =
    providerMode === 'real'
      ? [...MOCK_MODELS, ...REAL_MODELS]
      : [...MOCK_MODELS];

  const { pool, db } = createDatabase();

  try {
    const result = await db
      .insert(modelConfigs)
      .values(
        models.map((m) => ({
          ...m,
          capabilities: [...m.capabilities],
          parametersSchema: { ...m.parametersSchema },
        })),
      )
      .onConflictDoNothing({
        target: [modelConfigs.providerId, modelConfigs.modelId],
      })
      .returning({
        providerId: modelConfigs.providerId,
        modelId: modelConfigs.modelId,
      });

    if (result.length > 0) {
      for (const row of result) {
        console.log(
          `[model:bootstrap] 已插入: ${row.providerId}/${row.modelId}`,
        );
      }
    } else {
      console.log('[model:bootstrap] 所有模型记录已存在，跳过插入。');
    }

    console.log(
      `[model:bootstrap] 完成（AI_PROVIDER_MODE=${providerMode}，共处理 ${models.length} 个模型）。`,
    );
  } finally {
    await pool.end();
  }
}

bootstrap().catch((error: unknown) => {
  console.error('[model:bootstrap] 失败:', error);
  process.exitCode = 1;
});
