import { Type, type Static } from '@sinclair/typebox';

// 基础类型
export const UuidSchema = Type.String({ format: 'uuid' });
export const EmailSchema = Type.String({ format: 'email', maxLength: 255 });
export const DateTimeSchema = Type.String({ format: 'date-time' });
export const DateSchema = Type.String({ pattern: '^\\d{4}-\\d{2}-\\d{2}$' });
export const ColorHexSchema = Type.String({ pattern: '^#[0-9A-Fa-f]{6}$' });

// 分页
export const PaginationQuerySchema = Type.Object(
  {
    cursor: Type.Optional(Type.String()),
    limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100 })),
  },
  { additionalProperties: false },
);

export const PageInfoSchema = Type.Object(
  {
    nextCursor: Type.Union([Type.String(), Type.Null()]),
    hasMore: Type.Boolean(),
  },
  { additionalProperties: false },
);

// 通用响应包装
export const DataResponseSchema = <T extends ReturnType<typeof Type.Object>>(
  dataSchema: T,
) =>
  Type.Object(
    {
      data: dataSchema,
    },
    { additionalProperties: false },
  );

export const ListResponseSchema = <T extends ReturnType<typeof Type.Any>>(
  itemSchema: T,
) =>
  Type.Object(
    {
      data: Type.Array(itemSchema),
      page: PageInfoSchema,
    },
    { additionalProperties: false },
  );

// 错误响应
export const ErrorDetailSchema = Type.Object(
  {
    field: Type.Optional(Type.String()),
    reason: Type.String(),
  },
  { additionalProperties: false },
);

export const ErrorResponseSchema = Type.Object(
  {
    error: Type.Object(
      {
        code: Type.String(),
        message: Type.String(),
        details: Type.Optional(Type.Array(ErrorDetailSchema)),
        requestId: Type.String(),
      },
      { additionalProperties: false },
    ),
  },
  { additionalProperties: false },
);

// 乐观锁
export const RevisionSchema = Type.Integer({ minimum: 1 });
export const ExpectedRevisionSchema = Type.Object(
  {
    expectedRevision: RevisionSchema,
  },
  { additionalProperties: false },
);

// 异步任务响应
export const AsyncTaskResponseSchema = Type.Object(
  {
    taskId: UuidSchema,
    status: Type.Union([
      Type.Literal('pending'),
      Type.Literal('queued'),
      Type.Literal('running'),
    ]),
  },
  { additionalProperties: false },
);

// 类型导出
export type Uuid = Static<typeof UuidSchema>;
export type DateTime = Static<typeof DateTimeSchema>;
export type PageInfo = Static<typeof PageInfoSchema>;
export type ErrorResponse = Static<typeof ErrorResponseSchema>;
export type AsyncTaskResponse = Static<typeof AsyncTaskResponseSchema>;
