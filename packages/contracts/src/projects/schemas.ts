import { Type, type Static } from '@sinclair/typebox';
import {
  UuidSchema,
  DateTimeSchema,
  DateSchema,
  RevisionSchema,
  PaginationQuerySchema,
} from '../common/base.js';

// 项目状态
export const ProjectStatusSchema = Type.Union([
  Type.Literal('draft'),
  Type.Literal('briefing'),
  Type.Literal('designing'),
  Type.Literal('reviewing'),
  Type.Literal('approved'),
  Type.Literal('archived'),
]);

// 项目摘要（列表用）
export const ProjectSummarySchema = Type.Object(
  {
    id: UuidSchema,
    name: Type.String({ minLength: 1, maxLength: 120 }),
    customerId: UuidSchema,
    customerName: Type.String(),
    ownerId: UuidSchema,
    ownerName: Type.String(),
    status: ProjectStatusSchema,
    exhibitionName: Type.Optional(Type.String()),
    exhibitionDate: Type.Optional(DateSchema),
    deliveryDeadline: Type.Optional(DateSchema),
    createdAt: DateTimeSchema,
    updatedAt: DateTimeSchema,
  },
  { additionalProperties: false },
);

// 项目详情
export const ProjectSchema = Type.Object(
  {
    id: UuidSchema,
    name: Type.String({ minLength: 1, maxLength: 120 }),
    customerId: UuidSchema,
    customerName: Type.String(),
    ownerId: UuidSchema,
    ownerName: Type.String(),
    status: ProjectStatusSchema,
    archivedFromStatus: Type.Union([ProjectStatusSchema, Type.Null()]),
    exhibitionName: Type.Optional(Type.String({ maxLength: 200 })),
    exhibitionVenue: Type.Optional(Type.String({ maxLength: 200 })),
    boothNumber: Type.Optional(Type.String({ maxLength: 50 })),
    exhibitionDate: Type.Optional(DateSchema),
    deliveryDeadline: Type.Optional(DateSchema),
    industry: Type.Optional(Type.String({ maxLength: 100 })),
    notes: Type.Optional(Type.String({ maxLength: 2000 })),
    currentBriefRevisionId: Type.Union([UuidSchema, Type.Null()]),
    selectedVersionId: Type.Union([UuidSchema, Type.Null()]),
    nextVersionSequence: Type.Integer({ minimum: 1 }),
    nextEventSequence: Type.Integer({ minimum: 1 }),
    createdAt: DateTimeSchema,
    updatedAt: DateTimeSchema,
    rejectionReason: Type.Union([
      Type.String({ maxLength: 2000 }),
      Type.Null(),
    ]),
    approvedAt: Type.Union([DateTimeSchema, Type.Null()]),
    approvedSnapshot: Type.Union([Type.Unknown(), Type.Null()]),
    revision: RevisionSchema,
  },
  { additionalProperties: false },
);

// GET /projects
export const ListProjectsQuerySchema = Type.Intersect([
  PaginationQuerySchema,
  Type.Object(
    {
      status: Type.Optional(ProjectStatusSchema),
      customerId: Type.Optional(UuidSchema),
      ownerId: Type.Optional(UuidSchema),
      search: Type.Optional(Type.String({ maxLength: 200 })),
    },
    { additionalProperties: false },
  ),
]);

export const ListProjectsResponseSchema = Type.Object(
  {
    data: Type.Array(ProjectSummarySchema),
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

// POST /projects
export const CreateProjectRequestSchema = Type.Object(
  {
    name: Type.String({ minLength: 1, maxLength: 120 }),
    customerId: UuidSchema,
    ownerId: UuidSchema,
    exhibitionName: Type.Optional(Type.String({ maxLength: 200 })),
    exhibitionVenue: Type.Optional(Type.String({ maxLength: 200 })),
    boothNumber: Type.Optional(Type.String({ maxLength: 50 })),
    exhibitionDate: Type.Optional(DateSchema),
    deliveryDeadline: Type.Optional(DateSchema),
    industry: Type.Optional(Type.String({ maxLength: 100 })),
    notes: Type.Optional(Type.String({ maxLength: 2000 })),
  },
  { additionalProperties: false },
);

export const CreateProjectResponseSchema = Type.Object(
  {
    data: ProjectSchema,
  },
  { additionalProperties: false },
);

// GET /projects/:id
export const GetProjectResponseSchema = Type.Object(
  {
    data: ProjectSchema,
  },
  { additionalProperties: false },
);

// PATCH /projects/:id
export const UpdateProjectRequestSchema = Type.Object(
  {
    name: Type.Optional(Type.String({ minLength: 1, maxLength: 120 })),
    ownerId: Type.Optional(UuidSchema),
    exhibitionName: Type.Optional(Type.String({ maxLength: 200 })),
    exhibitionVenue: Type.Optional(Type.String({ maxLength: 200 })),
    boothNumber: Type.Optional(Type.String({ maxLength: 50 })),
    exhibitionDate: Type.Optional(DateSchema),
    deliveryDeadline: Type.Optional(DateSchema),
    industry: Type.Optional(Type.String({ maxLength: 100 })),
    notes: Type.Optional(Type.String({ maxLength: 2000 })),
    expectedRevision: RevisionSchema,
  },
  { additionalProperties: false },
);

export const UpdateProjectResponseSchema = Type.Object(
  {
    data: ProjectSchema,
  },
  { additionalProperties: false },
);

// GET /projects/:id/members
export const ProjectMemberSchema = Type.Object(
  {
    userId: UuidSchema,
    userName: Type.String(),
    userEmail: Type.String(),
    userRole: Type.String(),
    addedBy: UuidSchema,
    addedAt: DateTimeSchema,
  },
  { additionalProperties: false },
);

export const ListProjectMembersResponseSchema = Type.Object(
  {
    data: Type.Array(ProjectMemberSchema),
  },
  { additionalProperties: false },
);

// POST /projects/:id/members
export const AddProjectMemberRequestSchema = Type.Object(
  {
    userId: UuidSchema,
  },
  { additionalProperties: false },
);

export const AddProjectMemberResponseSchema = Type.Object(
  {
    data: ProjectMemberSchema,
  },
  { additionalProperties: false },
);

// DELETE /projects/:id/members/:userId
export const RemoveProjectMemberRequestSchema = Type.Object(
  {
    expectedRevision: RevisionSchema,
  },
  { additionalProperties: false },
);

// POST /projects/:id/transfer-owner
export const TransferOwnerRequestSchema = Type.Object(
  {
    userId: UuidSchema,
    expectedRevision: RevisionSchema,
  },
  { additionalProperties: false },
);

export const TransferOwnerResponseSchema = Type.Object(
  {
    data: ProjectSchema,
  },
  { additionalProperties: false },
);

// POST /projects/:id/transitions
export const ProjectTransitionActionSchema = Type.Union([
  Type.Literal('submit_review'),
  Type.Literal('approve'),
  Type.Literal('request_changes'),
  Type.Literal('reopen'),
  Type.Literal('archive'),
  Type.Literal('restore'),
]);

export const ProjectTransitionRequestSchema = Type.Object(
  {
    action: ProjectTransitionActionSchema,
    comment: Type.Optional(Type.String({ maxLength: 2000 })),
    expectedRevision: RevisionSchema,
  },
  { additionalProperties: false },
);

export const ProjectTransitionResponseSchema = Type.Object(
  {
    data: ProjectSchema,
  },
  { additionalProperties: false },
);

// 类型导出
export type ProjectStatus = Static<typeof ProjectStatusSchema>;
export type ProjectSummary = Static<typeof ProjectSummarySchema>;
export type Project = Static<typeof ProjectSchema>;
export type CreateProjectRequest = Static<typeof CreateProjectRequestSchema>;
export type UpdateProjectRequest = Static<typeof UpdateProjectRequestSchema>;
export type ProjectMember = Static<typeof ProjectMemberSchema>;
export type AddProjectMemberRequest = Static<
  typeof AddProjectMemberRequestSchema
>;
export type TransferOwnerRequest = Static<typeof TransferOwnerRequestSchema>;
export type ProjectTransitionAction = Static<
  typeof ProjectTransitionActionSchema
>;
export type ProjectTransitionRequest = Static<
  typeof ProjectTransitionRequestSchema
>;
