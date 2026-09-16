import {
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
  varchar,
  date,
} from 'drizzle-orm/pg-core';
import { customers } from './customers.js';
import { users } from './users.js';

export const projectStatusEnum = pgEnum('project_status', [
  'draft',
  'briefing',
  'designing',
  'reviewing',
  'approved',
  'archived',
]);

export const projects = pgTable('projects', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 120 }).notNull(),
  customerId: uuid('customer_id')
    .notNull()
    .references(() => customers.id),
  ownerId: uuid('owner_id')
    .notNull()
    .references(() => users.id),
  status: projectStatusEnum('status').notNull().default('draft'),
  archivedFromStatus: projectStatusEnum('archived_from_status'),
  exhibitionName: varchar('exhibition_name', { length: 200 }),
  exhibitionVenue: varchar('exhibition_venue', { length: 200 }),
  boothNumber: varchar('booth_number', { length: 50 }),
  exhibitionDate: date('exhibition_date'),
  deliveryDeadline: date('delivery_deadline'),
  industry: varchar('industry', { length: 100 }),
  notes: text('notes'),
  currentBriefRevisionId: uuid('current_brief_revision_id'),
  selectedVersionId: uuid('selected_version_id'),
  nextVersionSequence: integer('next_version_sequence').notNull().default(1),
  nextEventSequence: integer('next_event_sequence').notNull().default(1),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  rejectionReason: text('rejection_reason'),
  approvedAt: timestamp('approved_at', { withTimezone: true }),
  approvedSnapshot: jsonb('approved_snapshot'),
  revision: integer('revision').notNull().default(1),
});

export const projectMembers = pgTable(
  'project_members',
  {
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    addedBy: uuid('added_by')
      .notNull()
      .references(() => users.id),
    addedAt: timestamp('added_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.projectId, table.userId] })],
);

export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;
export type ProjectMember = typeof projectMembers.$inferSelect;
export type NewProjectMember = typeof projectMembers.$inferInsert;
