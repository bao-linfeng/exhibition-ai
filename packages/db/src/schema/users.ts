import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  boolean,
  pgEnum,
  integer,
} from 'drizzle-orm/pg-core';

// 用户角色枚举
export const userRoleEnum = pgEnum('user_role', [
  'admin',
  'designer',
  'sales',
  'viewer',
]);

// 用户状态枚举
export const userStatusEnum = pgEnum('user_status', ['enabled', 'disabled']);

// 用户表
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  displayName: varchar('display_name', { length: 100 }).notNull(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  role: userRoleEnum('role').notNull().default('viewer'),
  status: userStatusEnum('status').notNull().default('enabled'),
  mustChangePassword: boolean('must_change_password').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  revision: integer('revision').notNull().default(1),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
