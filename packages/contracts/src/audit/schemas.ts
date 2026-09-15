import { Type, type Static } from '@sinclair/typebox';
import {
  UuidSchema,
  DateTimeSchema,
  PaginationQuerySchema,
} from '../common/base.js';

// 审计事件类型
export const AuditEventTypeSchema = Type.Union([
  Type.Literal('user.login'),
  Type.Literal('user.logout'),
  Type.Literal('user.created'),
  Type.Literal('user.updated'),
  Type.Literal('project.created'),
  Type.Literal('project.updated'),
  Type.Literal('project.transitioned'),
  Type.Literal('project.member_added'),
  Type.Literal('project.member_removed'),
  Type.Literal('project.owner_transferred'),
  Type.Literal('brief.updated'),
  Type.Literal('brief.confirmed'),
  Type.Literal('generation.created'),
  Type.Literal('task.cancelled'),
  Type.Literal('task.retried'),
  Type.Literal('task.reconciled'),
  Type.Literal('asset.uploaded'),
  Type.Literal('asset.hidden'),
  Type.Literal('version.selected'),
  Type.Literal('export.created'),
]);

// 审计日志
export const AuditLogSchema = Type.Object(
  {
    id: UuidSchema,
    eventType: AuditEventTypeSchema,
    actorId: Type.Union([UuidSchema, Type.Null()]),
    actorEmail: Type.Union([Type.String(), Type.Null()]),
    projectId: Type.Union([UuidSchema, Type.Null()]),
    resourceType: Type.Union([Type.String(), Type.Null()]),
    resourceId: Type.Union([UuidSchema, Type.Null()]),
    metadata: Type.Record(Type.String(), Type.Any()),
    ipAddress: Type.Union([Type.String(), Type.Null()]),
    userAgent: Type.Union([Type.String(), Type.Null()]),
    createdAt: DateTimeSchema,
  },
  { additionalProperties: false },
);

// GET /audit-logs - 管理员查询审计日志
export const ListAuditLogsQuerySchema = Type.Intersect([
  PaginationQuerySchema,
  Type.Object(
    {
      eventType: Type.Optional(AuditEventTypeSchema),
      actorId: Type.Optional(UuidSchema),
      projectId: Type.Optional(UuidSchema),
      resourceType: Type.Optional(Type.String({ maxLength: 100 })),
      startDate: Type.Optional(Type.String({ format: 'date-time' })),
      endDate: Type.Optional(Type.String({ format: 'date-time' })),
    },
    { additionalProperties: false },
  ),
]);

export const ListAuditLogsResponseSchema = Type.Object(
  {
    data: Type.Array(AuditLogSchema),
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
export type AuditEventType = Static<typeof AuditEventTypeSchema>;
export type AuditLog = Static<typeof AuditLogSchema>;
export type ListAuditLogsQuery = Static<typeof ListAuditLogsQuerySchema>;
