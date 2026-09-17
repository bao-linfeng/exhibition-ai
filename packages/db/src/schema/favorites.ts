import {
  index,
  pgTable,
  primaryKey,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { assets } from './assets.js';
import { imageVersions } from './image_versions.js';
import { projects } from './projects.js';
import { users } from './users.js';

// 个人收藏 - 资产
export const userAssetFavorites = pgTable(
  'user_asset_favorites',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    assetId: uuid('asset_id')
      .notNull()
      .references(() => assets.id, { onDelete: 'cascade' }),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.assetId] }),
    index('user_asset_favorites_user_project_idx').on(
      table.userId,
      table.projectId,
    ),
    index('user_asset_favorites_project_idx').on(table.projectId),
  ],
);

// 个人收藏 - 图片版本
export const userImageVersionFavorites = pgTable(
  'user_image_version_favorites',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    versionId: uuid('version_id')
      .notNull()
      .references(() => imageVersions.id, { onDelete: 'cascade' }),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.versionId] }),
    index('user_image_version_favorites_user_project_idx').on(
      table.userId,
      table.projectId,
    ),
    index('user_image_version_favorites_project_idx').on(table.projectId),
  ],
);

export type UserAssetFavorite = typeof userAssetFavorites.$inferSelect;
export type UserImageVersionFavorite =
  typeof userImageVersionFavorites.$inferSelect;
