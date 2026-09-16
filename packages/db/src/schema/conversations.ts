import { sql } from 'drizzle-orm';
import {
  type AnyPgColumn,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { projects } from './projects.js';
import { tasks } from './tasks.js';
import { users } from './users.js';

export const conversations = pgTable(
  'conversations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    title: varchar('title', { length: 200 }).notNull().default('默认会话'),
    activeRunId: uuid('active_run_id').references(
      (): AnyPgColumn => agentRuns.id,
    ),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('conversations_project_id_idx').on(table.projectId),
    uniqueIndex('conversations_project_unique_idx').on(table.projectId),
  ],
);

export const messages = pgTable(
  'messages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    conversationId: uuid('conversation_id')
      .notNull()
      .references(() => conversations.id, { onDelete: 'cascade' }),
    runId: uuid('run_id').references(() => agentRuns.id),
    role: varchar('role', { length: 20 }).notNull(),
    parts: jsonb('parts').notNull().default([]),
    status: varchar('status', { length: 20 }).notNull().default('pending'),
    streamOffset: integer('stream_offset').notNull().default(0),
    clientMessageId: varchar('client_message_id', { length: 100 }),
    createdBy: uuid('created_by').references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('messages_conversation_id_idx').on(table.conversationId),
    index('messages_run_id_idx').on(table.runId),
    index('messages_client_message_id_idx').on(table.clientMessageId),
    uniqueIndex('messages_client_message_id_unique')
      .on(table.clientMessageId)
      .where(sql`${table.clientMessageId} IS NOT NULL`),
    check(
      'messages_role_check',
      sql`${table.role} IN ('user', 'assistant', 'system')`,
    ),
    check(
      'messages_status_check',
      sql`${table.status} IN ('pending', 'streaming', 'completed', 'interrupted', 'failed')`,
    ),
  ],
);

export const agentRuns = pgTable(
  'agent_runs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    conversationId: uuid('conversation_id')
      .notNull()
      .references(() => conversations.id, { onDelete: 'cascade' }),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    taskId: uuid('task_id')
      .notNull()
      .references(() => tasks.id, { onDelete: 'cascade' }),
    status: varchar('status', { length: 20 }).notNull().default('pending'),
    toolCallCount: integer('tool_call_count').notNull().default(0),
    startedAt: timestamp('started_at', { withTimezone: true }),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
    errorCode: varchar('error_code', { length: 100 }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('agent_runs_conversation_id_idx').on(table.conversationId),
    index('agent_runs_task_id_idx').on(table.taskId),
    check(
      'agent_runs_status_check',
      sql`${table.status} IN ('pending', 'running', 'awaiting_confirmation', 'completed', 'interrupted', 'failed', 'cancelled')`,
    ),
  ],
);

export const confirmations = pgTable(
  'confirmations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    runId: uuid('run_id')
      .notNull()
      .references(() => agentRuns.id, { onDelete: 'cascade' }),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    requestedBy: uuid('requested_by')
      .notNull()
      .references(() => users.id),
    action: varchar('action', { length: 50 }).notNull(),
    payload: jsonb('payload').notNull(),
    payloadHash: varchar('payload_hash', { length: 64 }).notNull(),
    estimatedFeeMinor: integer('estimated_fee_minor'),
    currency: varchar('currency', { length: 3 }),
    status: varchar('status', { length: 20 }).notNull().default('pending'),
    resultTaskId: uuid('result_task_id'),
    resultBriefRevisionId: uuid('result_brief_revision_id'),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('confirmations_run_id_idx').on(table.runId),
    index('confirmations_project_id_idx').on(table.projectId),
    index('confirmations_status_idx').on(table.status),
    check(
      'confirmations_action_check',
      sql`${table.action} IN ('apply_brief_patch', 'create_generation')`,
    ),
    check(
      'confirmations_status_check',
      sql`${table.status} IN ('pending', 'approved', 'rejected', 'expired')`,
    ),
  ],
);

export type Conversation = typeof conversations.$inferSelect;
export type NewConversation = typeof conversations.$inferInsert;
export type Message = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;
export type AgentRun = typeof agentRuns.$inferSelect;
export type NewAgentRun = typeof agentRuns.$inferInsert;
export type Confirmation = typeof confirmations.$inferSelect;
export type NewConfirmation = typeof confirmations.$inferInsert;
