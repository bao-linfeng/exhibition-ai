import {
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { assets } from './assets.js';
import { projects } from './projects.js';
import { tasks } from './tasks.js';
import { users } from './users.js';

export const exportRecords = pgTable(
  'export_records',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    taskId: uuid('task_id').references(() => tasks.id, {
      onDelete: 'set null',
    }),
    format: varchar('format', { length: 20 }).notNull().default('zip'),
    versionIds: jsonb('version_ids').$type<string[]>().notNull(),
    status: varchar('status', { length: 20 }).notNull().default('pending'),
    resultAssetId: uuid('result_asset_id').references(() => assets.id, {
      onDelete: 'set null',
    }),
    errorMessage: text('error_message'),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
  },
  (table) => [
    index('export_records_project_id_idx').on(table.projectId),
    index('export_records_task_id_idx').on(table.taskId),
    index('export_records_status_idx').on(table.status),
  ],
);

export type ExportRecord = typeof exportRecords.$inferSelect;
export type NewExportRecord = typeof exportRecords.$inferInsert;
