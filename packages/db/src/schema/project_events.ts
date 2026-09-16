import { index, integer, jsonb, pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { projects } from './projects.js';

export const projectEvents = pgTable(
  'project_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    sequence: integer('sequence').notNull(),
    type: varchar('type', { length: 50 }).notNull(),
    data: jsonb('data').notNull(),
    resourceId: uuid('resource_id'),
    resourceRevision: integer('resource_revision'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('project_events_project_sequence_idx').on(
      table.projectId,
      table.sequence,
    ),
    index('project_events_created_at_idx').on(table.createdAt),
  ],
);

export type ProjectEvent = typeof projectEvents.$inferSelect;
export type NewProjectEvent = typeof projectEvents.$inferInsert;
