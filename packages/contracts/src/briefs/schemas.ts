import { Type, type Static } from '@sinclair/typebox';
import {
  UuidSchema,
  DateTimeSchema,
  DateSchema,
  ColorHexSchema,
  RevisionSchema,
} from '../common/base.js';

// 展台开放面
export const BoothOpenSideSchema = Type.Union([
  Type.Literal('front'),
  Type.Literal('right'),
  Type.Literal('back'),
  Type.Literal('left'),
]);

// 展台尺寸
export const BoothDimensionsSchema = Type.Object(
  {
    widthM: Type.Number({ minimum: 0.01, maximum: 100, multipleOf: 0.01 }),
    depthM: Type.Number({ minimum: 0.01, maximum: 100, multipleOf: 0.01 }),
    heightLimitM: Type.Number({
      minimum: 0.01,
      maximum: 100,
      multipleOf: 0.01,
    }),
    openSides: Type.Array(BoothOpenSideSchema, {
      minItems: 1,
      maxItems: 4,
      uniqueItems: true,
    }),
    hallRestrictions: Type.Optional(Type.String({ maxLength: 4000 })),
  },
  { additionalProperties: false },
);

// 品牌信息
export const BrandInfoSchema = Type.Object(
  {
    name: Type.String({ minLength: 1, maxLength: 120 }),
    primaryColor: Type.Optional(ColorHexSchema),
    secondaryColor: Type.Optional(ColorHexSchema),
    logoAssetId: Type.Optional(UuidSchema),
    visualKeywords: Type.Optional(
      Type.Array(Type.String({ maxLength: 40 }), { maxItems: 10 }),
    ),
  },
  { additionalProperties: false },
);

// 功能区域
export const FunctionalAreaTypeSchema = Type.Union([
  Type.Literal('reception'),
  Type.Literal('meeting'),
  Type.Literal('display'),
  Type.Literal('storage'),
  Type.Literal('led'),
  Type.Literal('demo'),
]);

export const FunctionalAreaSchema = Type.Object(
  {
    type: FunctionalAreaTypeSchema,
    required: Type.Boolean(),
    quantity: Type.Optional(Type.Integer({ minimum: 1, maximum: 100 })),
    description: Type.Optional(Type.String({ maxLength: 500 })),
  },
  { additionalProperties: false },
);

// 风格偏好
export const StylePreferencesSchema = Type.Object(
  {
    keywords: Type.Array(Type.String({ maxLength: 80 }), {
      minItems: 1,
      maxItems: 20,
    }),
    materials: Type.Optional(
      Type.Array(Type.String({ maxLength: 80 }), { maxItems: 20 }),
    ),
    forbiddenElements: Type.Optional(
      Type.Array(Type.String({ maxLength: 80 }), { maxItems: 20 }),
    ),
  },
  { additionalProperties: false },
);

// 预算
export const BudgetSchema = Type.Object(
  {
    amountMinor: Type.Integer({ minimum: 0 }),
    currency: Type.Literal('CNY'),
  },
  { additionalProperties: false },
);

// Brief 内容（不可变快照）
export const BriefContentSchema = Type.Object(
  {
    booth: BoothDimensionsSchema,
    brand: BrandInfoSchema,
    functionalAreas: Type.Array(FunctionalAreaSchema, {
      minItems: 1,
      maxItems: 20,
    }),
    style: StylePreferencesSchema,
    budget: Type.Optional(BudgetSchema),
    deadline: Type.Optional(DateSchema),
    specialRequirements: Type.Optional(Type.String({ maxLength: 8000 })),
  },
  { additionalProperties: false },
);

// Brief Revision（历史版本）
export const BriefRevisionSchema = Type.Object(
  {
    id: UuidSchema,
    projectId: UuidSchema,
    number: Type.Integer({ minimum: 1 }),
    content: BriefContentSchema,
    createdBy: UuidSchema,
    createdAt: DateTimeSchema,
    confirmedBy: Type.Union([UuidSchema, Type.Null()]),
    confirmedAt: Type.Union([DateTimeSchema, Type.Null()]),
  },
  { additionalProperties: false },
);

// GET /projects/:id/brief
export const GetBriefResponseSchema = Type.Object(
  {
    data: Type.Union([BriefRevisionSchema, Type.Null()]),
  },
  { additionalProperties: false },
);

// PUT /projects/:id/brief
export const UpdateBriefRequestSchema = Type.Object(
  {
    content: BriefContentSchema,
    expectedRevision: RevisionSchema,
  },
  { additionalProperties: false },
);

export const UpdateBriefResponseSchema = Type.Object(
  {
    data: BriefRevisionSchema,
  },
  { additionalProperties: false },
);

// GET /projects/:id/brief-revisions
export const ListBriefRevisionsQuerySchema = Type.Object(
  {
    cursor: Type.Optional(Type.String()),
    limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 50 })),
  },
  { additionalProperties: false },
);

export const ListBriefRevisionsResponseSchema = Type.Object(
  {
    data: Type.Array(BriefRevisionSchema),
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

// GET /projects/:id/brief-revisions/:revisionId
export const GetBriefRevisionResponseSchema = Type.Object(
  {
    data: BriefRevisionSchema,
  },
  { additionalProperties: false },
);

// POST /projects/:id/brief/parse
export const ParseBriefRequestSchema = Type.Object(
  {
    text: Type.String({ minLength: 1, maxLength: 50000 }),
    baseBriefRevisionId: Type.Optional(UuidSchema),
  },
  { additionalProperties: false },
);

export const ParseBriefResponseSchema = Type.Object(
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

// POST /projects/:id/brief/confirm
export const ConfirmBriefRequestSchema = Type.Object(
  {
    briefRevisionId: UuidSchema,
    expectedRevision: RevisionSchema,
  },
  { additionalProperties: false },
);

export const ConfirmBriefResponseSchema = Type.Object(
  {
    data: BriefRevisionSchema,
  },
  { additionalProperties: false },
);

// 类型导出
export type BoothOpenSide = Static<typeof BoothOpenSideSchema>;
export type BoothDimensions = Static<typeof BoothDimensionsSchema>;
export type BrandInfo = Static<typeof BrandInfoSchema>;
export type FunctionalAreaType = Static<typeof FunctionalAreaTypeSchema>;
export type FunctionalArea = Static<typeof FunctionalAreaSchema>;
export type StylePreferences = Static<typeof StylePreferencesSchema>;
export type Budget = Static<typeof BudgetSchema>;
export type BriefContent = Static<typeof BriefContentSchema>;
export type BriefRevision = Static<typeof BriefRevisionSchema>;
export type UpdateBriefRequest = Static<typeof UpdateBriefRequestSchema>;
export type ParseBriefRequest = Static<typeof ParseBriefRequestSchema>;
export type ConfirmBriefRequest = Static<typeof ConfirmBriefRequestSchema>;
