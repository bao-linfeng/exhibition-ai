import { Type, type Static } from '@sinclair/typebox';
import {
  UuidSchema,
  DateTimeSchema,
  PaginationQuerySchema,
} from '../common/base.js';

// 导出格式
export const ExportFormatSchema = Type.Union([Type.Literal('zip')]);

// 导出任务
export const ExportTaskSchema = Type.Object(
  {
    id: UuidSchema,
    projectId: UuidSchema,
    format: ExportFormatSchema,
    versionIds: Type.Array(UuidSchema, { minItems: 1, maxItems: 20 }),
    status: Type.Union([
      Type.Literal('pending'),
      Type.Literal('queued'),
      Type.Literal('running'),
      Type.Literal('succeeded'),
      Type.Literal('failed'),
    ]),
    resultAssetId: Type.Union([UuidSchema, Type.Null()]),
    errorMessage: Type.Union([Type.String(), Type.Null()]),
    createdBy: UuidSchema,
    createdAt: DateTimeSchema,
    finishedAt: Type.Union([DateTimeSchema, Type.Null()]),
  },
  { additionalProperties: false },
);

// POST /projects/:id/exports
export const CreateExportRequestSchema = Type.Object(
  {
    versionIds: Type.Array(UuidSchema, {
      minItems: 1,
      maxItems: 20,
      uniqueItems: true,
    }),
    format: Type.Optional(ExportFormatSchema),
  },
  { additionalProperties: false },
);

export const CreateExportResponseSchema = Type.Object(
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

// GET /projects/:id/exports
export const ListExportsQuerySchema = PaginationQuerySchema;

export const ListExportsResponseSchema = Type.Object(
  {
    data: Type.Array(ExportTaskSchema),
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

// GET /exports/:id
export const GetExportResponseSchema = Type.Object(
  {
    data: ExportTaskSchema,
  },
  { additionalProperties: false },
);

// 类型导出
export type ExportFormat = Static<typeof ExportFormatSchema>;
export type ExportTask = Static<typeof ExportTaskSchema>;
export type CreateExportRequest = Static<typeof CreateExportRequestSchema>;
