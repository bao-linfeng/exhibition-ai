import { Type, type Static } from '@sinclair/typebox';
import {
  UuidSchema,
  DateTimeSchema,
  RevisionSchema,
  PaginationQuerySchema,
} from '../common/base.js';

// 图片版本
export const ImageVersionSchema = Type.Object(
  {
    id: UuidSchema,
    projectId: UuidSchema,
    assetId: UuidSchema,
    parentVersionId: Type.Union([UuidSchema, Type.Null()]),
    taskId: UuidSchema,
    outputOrdinal: Type.Integer({ minimum: 0 }),
    sequence: Type.Integer({ minimum: 1 }),
    briefRevisionId: UuidSchema,
    width: Type.Integer({ minimum: 1 }),
    height: Type.Integer({ minimum: 1 }),
    sizeBytes: Type.Integer({ minimum: 0 }),
    mimeType: Type.String(),
    createdBy: UuidSchema,
    createdAt: DateTimeSchema,
  },
  { additionalProperties: false },
);

// GET /projects/:id/image-versions
export const ListImageVersionsQuerySchema = Type.Intersect([
  PaginationQuerySchema,
  Type.Object(
    {
      parentVersionId: Type.Optional(
        Type.Union([UuidSchema, Type.Literal('root')]),
      ),
      briefRevisionId: Type.Optional(UuidSchema),
    },
    { additionalProperties: false },
  ),
]);

export const ListImageVersionsResponseSchema = Type.Object(
  {
    data: Type.Array(ImageVersionSchema),
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

// GET /image-versions/:id
export const GetImageVersionResponseSchema = Type.Object(
  {
    data: ImageVersionSchema,
  },
  { additionalProperties: false },
);

// PUT /projects/:id/selected-version
export const UpdateSelectedVersionRequestSchema = Type.Object(
  {
    versionId: Type.Union([UuidSchema, Type.Null()]),
    expectedRevision: RevisionSchema,
  },
  { additionalProperties: false },
);

export const UpdateSelectedVersionResponseSchema = Type.Object(
  {
    data: Type.Object(
      {
        selectedVersionId: Type.Union([UuidSchema, Type.Null()]),
        revision: RevisionSchema,
      },
      { additionalProperties: false },
    ),
  },
  { additionalProperties: false },
);

// POST /image-versions/:id/hide
export const HideVersionRequestSchema = Type.Object(
  {
    reason: Type.Optional(Type.String({ maxLength: 500 })),
  },
  { additionalProperties: false },
);

export const HideVersionResponseSchema = Type.Object(
  {
    data: Type.Object(
      {
        versionId: UuidSchema,
        hidden: Type.Boolean(),
      },
      { additionalProperties: false },
    ),
  },
  { additionalProperties: false },
);

// 类型导出
export type ImageVersion = Static<typeof ImageVersionSchema>;
export type UpdateSelectedVersionRequest = Static<
  typeof UpdateSelectedVersionRequestSchema
>;
export type HideVersionRequest = Static<typeof HideVersionRequestSchema>;
