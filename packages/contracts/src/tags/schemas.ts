import { Type, type Static } from '@sinclair/typebox';
import { UuidSchema, DateTimeSchema, ColorHexSchema } from '../common/base.js';

// 标签详情
export const ProjectTagSchema = Type.Object(
  {
    id: UuidSchema,
    projectId: UuidSchema,
    name: Type.String({ minLength: 1, maxLength: 50 }),
    color: Type.Union([ColorHexSchema, Type.Null()]),
    createdBy: UuidSchema,
    createdAt: DateTimeSchema,
    updatedAt: DateTimeSchema,
  },
  { additionalProperties: false },
);

// POST /projects/:projectId/tags
export const CreateTagRequestSchema = Type.Object(
  {
    name: Type.String({ minLength: 1, maxLength: 50 }),
    color: Type.Optional(ColorHexSchema),
  },
  { additionalProperties: false },
);

export const CreateTagResponseSchema = Type.Object(
  { data: ProjectTagSchema },
  { additionalProperties: false },
);

// GET /projects/:projectId/tags
export const ListTagsResponseSchema = Type.Object(
  {
    data: Type.Array(ProjectTagSchema),
  },
  { additionalProperties: false },
);

// PATCH /projects/:projectId/tags/:tagId
export const UpdateTagRequestSchema = Type.Object(
  {
    name: Type.Optional(Type.String({ minLength: 1, maxLength: 50 })),
    color: Type.Optional(Type.Union([ColorHexSchema, Type.Null()])),
  },
  { additionalProperties: false },
);

export const UpdateTagResponseSchema = Type.Object(
  { data: ProjectTagSchema },
  { additionalProperties: false },
);

// PUT /projects/:projectId/tags/:tagId/assets/:assetId
// PUT /projects/:projectId/tags/:tagId/versions/:versionId
// 响应 204 No Content

// 类型导出
export type ProjectTag = Static<typeof ProjectTagSchema>;
export type CreateTagRequest = Static<typeof CreateTagRequestSchema>;
export type UpdateTagRequest = Static<typeof UpdateTagRequestSchema>;
