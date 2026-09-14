import { Type, type Static } from '@sinclair/typebox';
import {
  UuidSchema,
  DateTimeSchema,
  RevisionSchema,
  PaginationQuerySchema,
} from '../common/base.js';

// 生成模式
export const GenerationModeSchema = Type.Union([
  Type.Literal('generate'),
  Type.Literal('edit'),
]);

// 尺寸预设
export const SizePresetSchema = Type.Union([
  Type.Literal('landscape_4_3'),
  Type.Literal('landscape_16_9'),
  Type.Literal('square_1_1'),
  Type.Literal('portrait_3_4'),
  Type.Literal('portrait_9_16'),
]);

// 生成参数
export const GenerationParametersSchema = Type.Object(
  {
    count: Type.Optional(Type.Integer({ minimum: 1, maximum: 4 })),
    sizePreset: SizePresetSchema,
    seed: Type.Optional(Type.Integer({ minimum: 0 })),
    negativePrompt: Type.Optional(Type.String({ maxLength: 1000 })),
  },
  { additionalProperties: false },
);

// POST /projects/:id/generations - 创建图片生成任务
export const CreateGenerationRequestSchema = Type.Union([
  // 生成新图（根方案）
  Type.Object(
    {
      mode: Type.Literal('generate'),
      briefRevisionId: UuidSchema,
      directionId: UuidSchema,
      parentVersionId: Type.Null(),
      inputAssetIds: Type.Optional(Type.Array(UuidSchema, { maxItems: 5 })),
      instruction: Type.String({ minLength: 1, maxLength: 2000 }),
      modelConfigId: UuidSchema,
      parameters: GenerationParametersSchema,
      expectedProjectRevision: RevisionSchema,
    },
    { additionalProperties: false },
  ),
  // 修改已有图片
  Type.Object(
    {
      mode: Type.Literal('edit'),
      briefRevisionId: UuidSchema,
      directionId: Type.Optional(UuidSchema),
      parentVersionId: UuidSchema,
      inputAssetIds: Type.Optional(Type.Array(UuidSchema, { maxItems: 5 })),
      instruction: Type.String({ minLength: 1, maxLength: 2000 }),
      modelConfigId: UuidSchema,
      parameters: GenerationParametersSchema,
      acknowledgeBriefChange: Type.Optional(Type.Boolean()),
      expectedProjectRevision: RevisionSchema,
    },
    { additionalProperties: false },
  ),
]);

export const CreateGenerationResponseSchema = Type.Object(
  {
    data: Type.Object(
      {
        taskId: UuidSchema,
        status: Type.Literal('pending'),
      },
      { additionalProperties: false },
    ),
  },
  { additionalProperties: false },
);

// GET /projects/:id/generations - 列出项目的生成任务
export const ListGenerationsQuerySchema = Type.Intersect([
  PaginationQuerySchema,
  Type.Object(
    {
      status: Type.Optional(
        Type.Union([
          Type.Literal('pending'),
          Type.Literal('queued'),
          Type.Literal('running'),
          Type.Literal('succeeded'),
          Type.Literal('partially_succeeded'),
          Type.Literal('failed'),
          Type.Literal('cancelled'),
        ]),
      ),
    },
    { additionalProperties: false },
  ),
]);

// 生成任务摘要
export const GenerationTaskSummarySchema = Type.Object(
  {
    id: UuidSchema,
    projectId: UuidSchema,
    mode: GenerationModeSchema,
    status: Type.Union([
      Type.Literal('pending'),
      Type.Literal('queued'),
      Type.Literal('running'),
      Type.Literal('succeeded'),
      Type.Literal('partially_succeeded'),
      Type.Literal('failed'),
      Type.Literal('cancelled'),
    ]),
    stage: Type.Optional(Type.String()),
    progress: Type.Union([
      Type.Number({ minimum: 0, maximum: 1 }),
      Type.Null(),
    ]),
    totalOutputs: Type.Integer({ minimum: 1 }),
    succeededOutputs: Type.Integer({ minimum: 0 }),
    failedOutputs: Type.Integer({ minimum: 0 }),
    createdBy: UuidSchema,
    createdAt: DateTimeSchema,
    startedAt: Type.Union([DateTimeSchema, Type.Null()]),
    finishedAt: Type.Union([DateTimeSchema, Type.Null()]),
  },
  { additionalProperties: false },
);

export const ListGenerationsResponseSchema = Type.Object(
  {
    data: Type.Array(GenerationTaskSummarySchema),
    page: Type.Object(
      {
        nextCursor: Type.Union([Type.String(), Type.Null()]),
        hasMore: Type.Boolean(),
      },
      { additionalProperties: false },
    ),
  },
  { additionalProperties: false },
);

// 类型导出
export type GenerationMode = Static<typeof GenerationModeSchema>;
export type SizePreset = Static<typeof SizePresetSchema>;
export type GenerationParameters = Static<typeof GenerationParametersSchema>;
export type CreateGenerationRequest = Static<
  typeof CreateGenerationRequestSchema
>;
export type GenerationTaskSummary = Static<typeof GenerationTaskSummarySchema>;
