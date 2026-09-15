import { Type, type Static } from '@sinclair/typebox';
import { UuidSchema, DateTimeSchema } from '../common/base.js';

// 模型配置（用于图片生成）
export const ModelConfigSchema = Type.Object(
  {
    id: UuidSchema,
    providerId: Type.String({ minLength: 1, maxLength: 100 }),
    modelId: Type.String({ minLength: 1, maxLength: 100 }),
    displayName: Type.String({ minLength: 1, maxLength: 200 }),
    description: Type.Optional(Type.String({ maxLength: 1000 })),
    capabilities: Type.Array(Type.String()),
    costPerImageMinor: Type.Integer({ minimum: 0 }),
    currency: Type.String({ maxLength: 3 }),
    isActive: Type.Boolean(),
    maxConcurrent: Type.Integer({ minimum: 1 }),
    createdAt: DateTimeSchema,
    updatedAt: DateTimeSchema,
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

// Admin PATCH /settings/model-configs/:id
export const UpdateModelConfigRequestSchema = Type.Object(
  {
    isActive: Type.Optional(Type.Boolean()),
    maxConcurrent: Type.Optional(Type.Integer({ minimum: 1, maximum: 20 })),
    costPerImageMinor: Type.Optional(Type.Integer({ minimum: 0 })),
    displayName: Type.Optional(Type.String({ minLength: 1, maxLength: 200 })),
    description: Type.Optional(Type.String({ maxLength: 1000 })),
  },
  { additionalProperties: false, minProperties: 1 },
);

export const UpdateModelConfigResponseSchema = Type.Object(
  {
    data: ModelConfigSchema,
  },
  { additionalProperties: false },
);

export const QuotaAccountSchema = Type.Object(
  {
    id: UuidSchema,
    ownerType: Type.Union([Type.Literal('system'), Type.Literal('user')]),
    ownerId: Type.Union([UuidSchema, Type.Null()]),
    balanceMinor: Type.Integer({ minimum: 0 }),
    reservedMinor: Type.Integer({ minimum: 0 }),
    availableMinor: Type.Integer({ minimum: 0 }),
    currency: Type.String({ maxLength: 3 }),
  },
  { additionalProperties: false },
);

export const GetQuotaResponseSchema = Type.Object(
  {
    data: QuotaAccountSchema,
  },
  { additionalProperties: false },
);

export const TopupQuotaRequestSchema = Type.Object(
  {
    ownerType: Type.Union([Type.Literal('system'), Type.Literal('user')]),
    ownerId: Type.Optional(UuidSchema),
    amountMinor: Type.Integer({ minimum: 1 }),
    currency: Type.String({ maxLength: 3 }),
    reason: Type.String({ minLength: 1, maxLength: 500 }),
  },
  { additionalProperties: false },
);

export const TopupQuotaResponseSchema = Type.Object(
  {
    data: QuotaAccountSchema,
  },
  { additionalProperties: false },
);

// 类型导出
export type ModelConfig = Static<typeof ModelConfigSchema>;
export type UpdateModelConfigRequest = Static<
  typeof UpdateModelConfigRequestSchema
>;
export type QuotaAccount = Static<typeof QuotaAccountSchema>;
export type TopupQuotaRequest = Static<typeof TopupQuotaRequestSchema>;
