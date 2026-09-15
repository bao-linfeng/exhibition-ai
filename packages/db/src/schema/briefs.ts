import { integer, jsonb, pgTable, timestamp, uuid } from 'drizzle-orm/pg-core';
import { projects } from './projects.js';
import { users } from './users.js';

export const briefRevisions = pgTable('brief_revisions', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  number: integer('number').notNull(),
  content: jsonb('content').notNull(),
  createdBy: uuid('created_by')
    .notNull()
    .references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  confirmedBy: uuid('confirmed_by').references(() => users.id),
  confirmedAt: timestamp('confirmed_at', { withTimezone: true }),
});

export type BriefRevision = typeof briefRevisions.$inferSelect;
export type NewBriefRevision = typeof briefRevisions.$inferInsert;
