import { Type, type Static } from '@sinclair/typebox';

export const PromptStatusSchema = Type.Union([
  Type.Literal('draft'),
  Type.Literal('published'),
  Type.Literal('archived'),
]);

export const PromptVersionSchema = Type.Object({
  id: Type.String(),
  templateId: Type.String(),
  version: Type.Integer(),
  status: PromptStatusSchema,
  content: Type.String(),
  variables: Type.Array(Type.String()),
  changeNote: Type.Union([Type.String(), Type.Null()]),
  publishedAt: Type.Union([Type.String({ format: 'date-time' }), Type.Null()]),
  publishedBy: Type.Union([Type.String(), Type.Null()]),
  createdAt: Type.String({ format: 'date-time' }),
  updatedAt: Type.String({ format: 'date-time' }),
});

export const PromptTemplateSchema = Type.Object({
  id: Type.String(),
  name: Type.String(),
  description: Type.Union([Type.String(), Type.Null()]),
  templateKey: Type.String(),
  currentVersionId: Type.Union([Type.String(), Type.Null()]),
  createdAt: Type.String({ format: 'date-time' }),
  updatedAt: Type.String({ format: 'date-time' }),
});

export const PromptTemplateWithVersionSchema = Type.Intersect([
  PromptTemplateSchema,
  Type.Object({
    currentVersion: Type.Union([PromptVersionSchema, Type.Null()]),
  }),
]);

export const ListPromptTemplatesResponseSchema = Type.Object({
  templates: Type.Array(PromptTemplateWithVersionSchema),
});

export const GetPromptTemplateResponseSchema = Type.Object({
  template: PromptTemplateWithVersionSchema,
  versions: Type.Array(PromptVersionSchema),
});

export const CreatePromptTemplateRequestSchema = Type.Object({
  name: Type.String({ minLength: 1 }),
  description: Type.Optional(Type.String()),
  templateKey: Type.String({ minLength: 1, pattern: '^[a-z][a-z0-9_]*$' }),
  initialContent: Type.String({ minLength: 1 }),
  variables: Type.Optional(Type.Array(Type.String())),
  changeNote: Type.Optional(Type.String()),
});

export const CreatePromptVersionRequestSchema = Type.Object({
  content: Type.String({ minLength: 1 }),
  variables: Type.Optional(Type.Array(Type.String())),
  changeNote: Type.Optional(Type.String()),
});

export const UpdatePromptVersionRequestSchema = Type.Object({
  content: Type.Optional(Type.String({ minLength: 1 })),
  variables: Type.Optional(Type.Array(Type.String())),
  changeNote: Type.Optional(Type.String()),
});

export const PublishPromptVersionRequestSchema = Type.Object({
  changeNote: Type.Optional(Type.String()),
});

export type PromptStatus = Static<typeof PromptStatusSchema>;
export type PromptVersion = Static<typeof PromptVersionSchema>;
export type PromptTemplate = Static<typeof PromptTemplateSchema>;
export type PromptTemplateWithVersion = Static<
  typeof PromptTemplateWithVersionSchema
>;
export type ListPromptTemplatesResponse = Static<
  typeof ListPromptTemplatesResponseSchema
>;
export type GetPromptTemplateResponse = Static<
  typeof GetPromptTemplateResponseSchema
>;
export type CreatePromptTemplateRequest = Static<
  typeof CreatePromptTemplateRequestSchema
>;
export type CreatePromptVersionRequest = Static<
  typeof CreatePromptVersionRequestSchema
>;
export type UpdatePromptVersionRequest = Static<
  typeof UpdatePromptVersionRequestSchema
>;
export type PublishPromptVersionRequest = Static<
  typeof PublishPromptVersionRequestSchema
>;
