import {
  type AnyPgColumn,
  bigint,
  index,
  integer,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { assets } from './assets.js';
import { projects } from './projects.js';
import { tasks } from './tasks.js';
import { users } from './users.js';

export const imageVersions = pgTable(
  'image_versions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    taskId: uuid('task_id')
      .notNull()
      .references(() => tasks.id, { onDelete: 'cascade' }),
    outputOrdinal: integer('output_ordinal').notNull(),
    assetId: uuid('asset_id')
      .notNull()
      .unique()
      .references(() => assets.id),
    parentVersionId: uuid('parent_version_id').references(
      (): AnyPgColumn => imageVersions.id,
    ),
    sequence: integer('sequence').notNull(),
    briefRevisionId: uuid('brief_revision_id').notNull(),
    width: integer('width').notNull(),
    height: integer('height').notNull(),
    sizeBytes: bigint('size_bytes', { mode: 'number' }).notNull(),
    mimeType: varchar('mime_type', { length: 127 }).notNull(),
    hiddenAt: timestamp('hidden_at', { withTimezone: true }),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('image_versions_project_id_idx').on(table.projectId),
    index('image_versions_task_id_idx').on(table.taskId),
    index('image_versions_parent_version_id_idx').on(table.parentVersionId),
    uniqueIndex('image_versions_project_sequence_unique').on(
      table.projectId,
      table.sequence,
    ),
  ],
);

export type ImageVersion = typeof imageVersions.$inferSelect;
export type NewImageVersion = typeof imageVersions.$inferInsert;
