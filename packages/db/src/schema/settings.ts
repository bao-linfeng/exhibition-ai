import {
  bigint,
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { tasks } from './tasks.js';

export const modelConfigs = pgTable(
  'model_configs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    providerId: varchar('provider_id', { length: 100 }).notNull(),
    modelId: varchar('model_id', { length: 100 }).notNull(),
    displayName: varchar('display_name', { length: 200 }).notNull(),
    description: text('description'),
    capabilities: jsonb('capabilities').notNull().default([]),
    costPerImageMinor: integer('cost_per_image_minor').notNull().default(0),
    currency: varchar('currency', { length: 3 }).notNull().default('CNY'),
    isActive: boolean('is_active').notNull().default(true),
    maxConcurrent: integer('max_concurrent').notNull().default(2),
    parametersSchema: jsonb('parameters_schema').notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex('model_configs_provider_model_idx').on(
      table.providerId,
      table.modelId,
    ),
    index('model_configs_active_idx').on(table.isActive),
  ],
);

export const quotaAccounts = pgTable(
  'quota_accounts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ownerType: varchar('owner_type', { length: 20 }).notNull(),
    ownerId: uuid('owner_id'),
    balanceMinor: bigint('balance_minor', { mode: 'number' })
      .notNull()
      .default(0),
    reservedMinor: bigint('reserved_minor', { mode: 'number' })
      .notNull()
      .default(0),
    currency: varchar('currency', { length: 3 }).notNull().default('CNY'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('quota_accounts_owner_type_idx').on(table.ownerType),
    index('quota_accounts_owner_id_idx').on(table.ownerId),
  ],
);

export const usageLedger = pgTable(
  'usage_ledger',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    taskId: uuid('task_id')
      .notNull()
      .references(() => tasks.id, { onDelete: 'restrict' }),
    attemptOrdinal: integer('attempt_ordinal'),
    accountId: uuid('account_id').notNull(),
    entryType: varchar('entry_type', { length: 30 }).notNull(),
    feeStatus: varchar('fee_status', { length: 20 }).notNull(),
    amountMinor: bigint('amount_minor', { mode: 'number' }).notNull(),
    currency: varchar('currency', { length: 3 }).notNull(),
    provider: varchar('provider', { length: 100 }),
    model: varchar('model', { length: 100 }),
    periodDate: date('period_date').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('usage_ledger_task_id_idx').on(table.taskId),
    index('usage_ledger_account_id_idx').on(table.accountId),
    index('usage_ledger_period_date_idx').on(table.periodDate),
    index('usage_ledger_entry_type_idx').on(table.entryType),
  ],
);

export type ModelConfig = typeof modelConfigs.$inferSelect;
export type NewModelConfig = typeof modelConfigs.$inferInsert;
export type QuotaAccount = typeof quotaAccounts.$inferSelect;
export type NewQuotaAccount = typeof quotaAccounts.$inferInsert;
export type UsageLedger = typeof usageLedger.$inferSelect;
export type NewUsageLedger = typeof usageLedger.$inferInsert;
