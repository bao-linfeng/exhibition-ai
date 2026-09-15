import {
  bigint,
  index,
  integer,
  pgEnum,
  pgTable,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { projects } from './projects.js';
import { users } from './users.js';

export const assetKindEnum = pgEnum('asset_kind', [
  'logo',
  'product',
  'reference',
  'brand_material',
  'generated_image',
  'thumbnail',
  'export_zip',
]);

export const assetStatusEnum = pgEnum('asset_status', [
  'pending',
  'validating',
  'ready',
  'rejected',
]);

export const uploadSessionStatusEnum = pgEnum('upload_session_status', [
  'initiated',
  'validating',
  'completed',
  'failed',
  'expired',
]);

export const assets = pgTable(
  'assets',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    kind: assetKindEnum('kind').notNull(),
    status: assetStatusEnum('status').notNull().default('pending'),
    bucket: varchar('bucket', { length: 100 }).notNull(),
    objectKey: varchar('object_key', { length: 512 }).notNull(),
    originalFilename: varchar('original_filename', { length: 255 }).notNull(),
    mimeType: varchar('mime_type', { length: 127 }).notNull(),
    sizeBytes: bigint('size_bytes', { mode: 'number' }).notNull(),
    width: integer('width'),
    height: integer('height'),
    sha256: varchar('sha256', { length: 64 }),
    sourceAssetId: uuid('source_asset_id'),
    hiddenAt: timestamp('hidden_at', { withTimezone: true }),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('assets_project_id_idx').on(table.projectId),
    index('assets_status_idx').on(table.status),
    index('assets_kind_idx').on(table.kind),
    index('assets_hidden_at_idx').on(table.hiddenAt),
  ],
);

export const uploadSessions = pgTable(
  'upload_sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    assetId: uuid('asset_id').references(() => assets.id, {
      onDelete: 'set null',
    }),
    status: uploadSessionStatusEnum('status').notNull().default('initiated'),
    bucket: varchar('bucket', { length: 100 }).notNull(),
    objectKey: varchar('object_key', { length: 512 }).notNull(),
    kind: assetKindEnum('kind').notNull(),
    originalFilename: varchar('original_filename', { length: 255 }).notNull(),
    mimeType: varchar('mime_type', { length: 127 }).notNull(),
    sizeBytes: bigint('size_bytes', { mode: 'number' }).notNull(),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => users.id),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('upload_sessions_project_id_idx').on(table.projectId),
    index('upload_sessions_status_idx').on(table.status),
    index('upload_sessions_expires_at_idx').on(table.expiresAt),
  ],
);

export type Asset = typeof assets.$inferSelect;
export type NewAsset = typeof assets.$inferInsert;
export type UploadSession = typeof uploadSessions.$inferSelect;
export type NewUploadSession = typeof uploadSessions.$inferInsert;
