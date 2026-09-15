import {
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { tasks } from './tasks.js';

export const generationRequests = pgTable(
  'generation_requests',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    taskId: uuid('task_id')
      .notNull()
      .references(() => tasks.id, { onDelete: 'cascade' }),
    projectId: uuid('project_id').notNull(),
    mode: varchar('mode', { length: 20 }).notNull(),
    briefRevisionId: uuid('brief_revision_id').notNull(),
    directionId: uuid('direction_id'),
    parentVersionId: uuid('parent_version_id'),
    inputAssetIds: jsonb('input_asset_ids').notNull().default([]),
    instruction: text('instruction').notNull(),
    modelConfigId: uuid('model_config_id').notNull(),
    parameters: jsonb('parameters').notNull(),
    parametersHash: varchar('parameters_hash', { length: 64 }).notNull(),
    idempotencyKey: varchar('idempotency_key', { length: 255 }).notNull(),
    requestedBy: uuid('requested_by').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex('generation_requests_idempotency_key_idx').on(
      table.idempotencyKey,
    ),
    index('generation_requests_task_id_idx').on(table.taskId),
    index('generation_requests_project_id_idx').on(table.projectId),
  ],
);

export type GenerationRequest = typeof generationRequests.$inferSelect;
export type NewGenerationRequest = typeof generationRequests.$inferInsert;
