import { Type, type Static } from '@sinclair/typebox';
import {
  UuidSchema,
  DateTimeSchema,
  PaginationQuerySchema,
} from '../common/base.js';

// 设计方向
export const DesignDirectionSchema = Type.Object(
  {
    id: UuidSchema,
    projectId: UuidSchema,
    briefRevisionId: UuidSchema,
    sourceTaskId: UuidSchema,
    title: Type.String({ minLength: 1, maxLength: 200 }),
    concept: Type.String({ maxLength: 2000 }),
    layoutDescription: Type.String({ maxLength: 2000 }),
    materialsAndColors: Type.String({ maxLength: 1000 }),
    constraintsChecklist: Type.Array(Type.String({ maxLength: 500 }), {
      maxItems: 20,
    }),
    questionsForConfirmation: Type.Optional(
      Type.Array(Type.String({ maxLength: 500 }), { maxItems: 10 }),
    ),
    createdBy: UuidSchema,
    createdAt: DateTimeSchema,
  },
  { additionalProperties: false },
);

// POST /projects/:id/design-directions
export const CreateDesignDirectionsRequestSchema = Type.Object(
  {
    briefRevisionId: UuidSchema,
    inputAssetIds: Type.Optional(Type.Array(UuidSchema, { maxItems: 10 })),
    count: Type.Optional(Type.Integer({ minimum: 1, maximum: 5 })),
  },
  { additionalProperties: false },
);

export const CreateDesignDirectionsResponseSchema = Type.Object(
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

// GET /projects/:id/design-directions
export const ListDesignDirectionsQuerySchema = Type.Intersect([
  PaginationQuerySchema,
  Type.Object(
    {
      briefRevisionId: Type.Optional(UuidSchema),
    },
    { additionalProperties: false },
  ),
]);

export const ListDesignDirectionsResponseSchema = Type.Object(
  {
    data: Type.Array(DesignDirectionSchema),
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

// GET /design-directions/:id
export const GetDesignDirectionResponseSchema = Type.Object(
  {
    data: DesignDirectionSchema,
  },
  { additionalProperties: false },
);

// 类型导出
export type DesignDirection = Static<typeof DesignDirectionSchema>;
export type CreateDesignDirectionsRequest = Static<
  typeof CreateDesignDirectionsRequestSchema
>;
