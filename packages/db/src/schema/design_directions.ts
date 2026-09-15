import {
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { projects } from './projects.js';
import { briefRevisions } from './briefs.js';
import { tasks } from './tasks.js';
import { users } from './users.js';

export const designDirections = pgTable(
  'design_directions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    briefRevisionId: uuid('brief_revision_id')
      .notNull()
      .references(() => briefRevisions.id, { onDelete: 'cascade' }),
    sourceTaskId: uuid('source_task_id')
      .notNull()
      .references(() => tasks.id, { onDelete: 'cascade' }),
    title: varchar('title', { length: 200 }).notNull(),
    concept: text('concept').notNull().default(''),
    layoutDescription: text('layout_description').notNull().default(''),
    materialsAndColors: varchar('materials_and_colors', { length: 1000 })
      .notNull()
      .default(''),
    constraintsChecklist: jsonb('constraints_checklist').notNull().default([]),
    questionsForConfirmation: jsonb('questions_for_confirmation'),
    promptSnapshot: jsonb('prompt_snapshot'),
    textUsage: jsonb('text_usage'),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('design_directions_project_id_idx').on(table.projectId),
    index('design_directions_brief_revision_id_idx').on(table.briefRevisionId),
  ],
);

export type DesignDirectionRow = typeof designDirections.$inferSelect;
export type NewDesignDirection = typeof designDirections.$inferInsert;
