import { integer, pgEnum, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { users } from './users.js';

export const customerStatusEnum = pgEnum('customer_status', ['active', 'inactive']);

export const customers = pgTable('customers', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 120 }).notNull(),
  contactName: varchar('contact_name', { length: 100 }),
  contactPhone: varchar('contact_phone', { length: 50 }),
  contactEmail: varchar('contact_email', { length: 255 }),
  industry: varchar('industry', { length: 100 }),
  address: varchar('address', { length: 500 }),
  notes: text('notes'),
  status: customerStatusEnum('status').notNull().default('active'),
  createdBy: uuid('created_by').notNull().references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  revision: integer('revision').notNull().default(1),
});

export type Customer = typeof customers.$inferSelect;
export type NewCustomer = typeof customers.$inferInsert;
