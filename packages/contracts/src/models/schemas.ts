import { Type, type Static } from '@sinclair/typebox';
import { UuidSchema } from '../common/base.js';

// 模型配置（用于图片生成）
export const ModelConfigSchema = Type.Object(
  {
    id: UuidSchema,
    providerId: Type.String({ minLength: 1, maxLength: 100 }),
    modelId: Type.String({ minLength: 1, maxLength: 100 }),
    displayName: Type.String({ minLength: 1, maxLength: 200 }),
    description: Type.Optional(Type.String({ maxLength: 1000 })),
    costPerImageMinor: Type.Integer({ minimum: 0 }),
    currency: Type.String({ maxLength: 3 }),
    isActive: Type.Boolean(),
  },
  { additionalProperties: false },
);

// GET /model-configs
export const ListModelConfigsResponseSchema = Type.Object(
  {
    data: Type.Array(ModelConfigSchema),
  },
  { additionalProperties: false },
);

// GET /model-configs/:id
export const GetModelConfigResponseSchema = Type.Object(
  {
    data: ModelConfigSchema,
  },
  { additionalProperties: false },
);

// 类型导出
export type ModelConfig = Static<typeof ModelConfigSchema>;
