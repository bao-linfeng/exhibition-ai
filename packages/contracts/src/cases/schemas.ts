import { Type, type Static } from '@sinclair/typebox';
import {
  UuidSchema,
  DateTimeSchema,
  PaginationQuerySchema,
} from '../common/base.js';

// 历史案例（已归档项目）摘要
export const CaseSchema = Type.Object(
  {
    id: UuidSchema, // project.id
    name: Type.String(), // project.name
    customerId: UuidSchema,
    customerName: Type.String(), // customer.name
    status: Type.Literal('archived'),
    archivedFromStatus: Type.Union([
      Type.Literal('draft'),
      Type.Literal('briefing'),
      Type.Literal('designing'),
      Type.Literal('reviewing'),
      Type.Literal('approved'),
      Type.Null(),
    ]),
    exhibitionName: Type.Union([Type.String(), Type.Null()]),
    exhibitionVenue: Type.Union([Type.String(), Type.Null()]),
    industry: Type.Union([Type.String(), Type.Null()]),
    selectedVersionId: Type.Union([UuidSchema, Type.Null()]),
    approvedAt: Type.Union([DateTimeSchema, Type.Null()]),
    archivedAt: Type.Union([DateTimeSchema, Type.Null()]), // updatedAt when archived
    createdAt: DateTimeSchema,
    tags: Type.Array(
      Type.Object(
        {
          id: UuidSchema,
          name: Type.String(),
          color: Type.Union([Type.String(), Type.Null()]),
        },
        { additionalProperties: false },
      ),
    ),
    favorited: Type.Boolean(), // 当前用户是否收藏了该案例（通过 selectedVersion 判断）
  },
  { additionalProperties: false },
);

// GET /api/v1/cases
export const ListCasesQuerySchema = Type.Intersect([
  PaginationQuerySchema,
  Type.Object(
    {
      search: Type.Optional(Type.String({ maxLength: 100 })),
      customerId: Type.Optional(UuidSchema),
      tagId: Type.Optional(UuidSchema),
      favorited: Type.Optional(Type.Boolean()),
    },
    { additionalProperties: false },
  ),
]);

export const ListCasesResponseSchema = Type.Object(
  {
    data: Type.Array(CaseSchema),
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
export type Case = Static<typeof CaseSchema>;
export type ListCasesQuery = Static<typeof ListCasesQuerySchema>;
