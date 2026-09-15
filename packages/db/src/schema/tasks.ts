import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { projects } from './projects.js';
import { users } from './users.js';

export const taskKindEnum = pgEnum('task_kind', [
  'asset_validation',
  'brief_parse',
  'design_direction',
  'image_generation',
  'agent_run',
  'export',
]);

export const taskStatusEnum = pgEnum('task_status', [
  'pending',
  'queued',
  'running',
  'awaiting_confirmation',
  'succeeded',
  'partially_succeeded',
  'failed',
  'cancelled',
  'reconciling',
]);

export const tasks = pgTable(
  'tasks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    kind: taskKindEnum('kind').notNull(),
    subtype: varchar('subtype', { length: 100 }),
    status: taskStatusEnum('status').notNull().default('pending'),
    idempotencyKey: varchar('idempotency_key', { length: 255 }),
    stage: varchar('stage', { length: 100 }),
    progress: text('progress'),
    inputSnapshot: jsonb('input_snapshot'),
    outputs: jsonb('outputs').notNull().default([]),
    fee: jsonb('fee'),
    errorCode: varchar('error_code', { length: 100 }),
    errorMessage: text('error_message'),
    canCancel: boolean('can_cancel').notNull().default(true),
    canRetry: boolean('can_retry').notNull().default(false),
    retryOfTaskId: uuid('retry_of_task_id'),
    requestedBy: uuid('requested_by')
      .notNull()
      .references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    startedAt: timestamp('started_at', { withTimezone: true }),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
  },
  (table) => [
    index('tasks_project_id_idx').on(table.projectId),
    index('tasks_status_idx').on(table.status),
    index('tasks_kind_idx').on(table.kind),
    index('tasks_idempotency_key_idx').on(table.idempotencyKey),
  ],
);

export const taskOutbox = pgTable(
  'task_outbox',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    taskId: uuid('task_id')
      .notNull()
      .references(() => tasks.id, { onDelete: 'cascade' }),
    queueName: varchar('queue_name', { length: 255 }).notNull(),
    payload: jsonb('payload').notNull(),
    attempts: integer('attempts').notNull().default(0),
    published: boolean('published').notNull().default(false),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    nextAttemptAt: timestamp('next_attempt_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('task_outbox_published_idx').on(table.published),
    index('task_outbox_next_attempt_idx').on(table.nextAttemptAt),
  ],
);

export type Task = typeof tasks.$inferSelect;
export type NewTask = typeof tasks.$inferInsert;
export type TaskOutbox = typeof taskOutbox.$inferSelect;
export type NewTaskOutbox = typeof taskOutbox.$inferInsert;
