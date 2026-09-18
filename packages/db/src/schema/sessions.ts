import {
  pgTable,
  uuid,
  timestamp,
  text,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { users } from './users.js';

// 会话表
export const sessions = pgTable(
  'sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tokenHash: text('token_hash').notNull(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    lastActivityAt: timestamp('last_activity_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    // 滑动过期：每次活跃后延长（空闲超时）
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    // 绝对过期：创建时固定，永不延长
    absoluteExpiresAt: timestamp('absolute_expires_at', {
      withTimezone: true,
    }).notNull(),
  },
  (t) => [uniqueIndex('sessions_token_hash_unique').on(t.tokenHash)],
);

export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;
