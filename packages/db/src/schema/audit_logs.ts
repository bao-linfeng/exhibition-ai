import {
  jsonb,
  pgEnum,
  pgTable,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { users } from './users.js';

// 审计事件类型枚举
export const auditEventTypeEnum = pgEnum('audit_event_type', [
  'user.login',
  'user.logout',
  'user.created',
  'user.updated',
  'project.created',
  'project.updated',
  'project.transitioned',
  'project.member_added',
  'project.member_removed',
  'project.owner_transferred',
  'brief.updated',
  'brief.confirmed',
  'generation.created',
  'task.cancelled',
  'task.retried',
  'task.reconciled',
  'asset.uploaded',
  'asset.hidden',
  'version.selected',
  'export.created',
  'settings.model_config.update',
  'quota.topup',
  'prompt_template.create',
  'prompt_version.create_draft',
  'prompt_version.update_draft',
  'prompt_version.publish',
  'prompt_version.rollback',
  'tag.create',
  'tag.update',
  'tag.delete',
  'tag.assign',
  'tag.unassign',
  'favorite.set',
  'favorite.unset',
]);

// 追加式审计日志表
export const auditLogs = pgTable('audit_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  eventType: auditEventTypeEnum('event_type').notNull(),
  actorId: uuid('actor_id').references(() => users.id, {
    onDelete: 'set null',
  }),
  actorEmail: varchar('actor_email', { length: 255 }),
  projectId: uuid('project_id'),
  resourceType: varchar('resource_type', { length: 100 }),
  resourceId: varchar('resource_id', { length: 255 }),
  metadata: jsonb('metadata').notNull().default({}),
  ipAddress: varchar('ip_address', { length: 45 }),
  userAgent: varchar('user_agent', { length: 500 }),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type AuditLog = typeof auditLogs.$inferSelect;
export type NewAuditLog = typeof auditLogs.$inferInsert;
