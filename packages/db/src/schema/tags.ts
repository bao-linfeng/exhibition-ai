import {
  index,
  pgTable,
  primaryKey,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { assets } from './assets.js';
import { imageVersions } from './image_versions.js';
import { projects } from './projects.js';
import { users } from './users.js';

// 项目共享标签
export const projectTags = pgTable(
  'project_tags',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 50 }).notNull(),
    nameKey: varchar('name_key', { length: 50 }).notNull(), // 规范化后的唯一键（小写+trim+NFKC）
    color: varchar('color', { length: 7 }), // #RRGGBB
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
    uniqueIndex('project_tags_project_name_key_unique').on(
      table.projectId,
      table.nameKey,
    ),
    index('project_tags_project_id_idx').on(table.projectId),
  ],
);

// 标签关联 - 资产
export const assetTagAssignments = pgTable(
  'asset_tag_assignments',
  {
    tagId: uuid('tag_id')
      .notNull()
      .references(() => projectTags.id, { onDelete: 'cascade' }),
    assetId: uuid('asset_id')
      .notNull()
      .references(() => assets.id, { onDelete: 'cascade' }),
    assignedBy: uuid('assigned_by')
      .notNull()
      .references(() => users.id),
    assignedAt: timestamp('assigned_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.tagId, table.assetId] }),
    index('asset_tag_assignments_asset_idx').on(table.assetId),
  ],
);

// 标签关联 - 图片版本
export const imageVersionTagAssignments = pgTable(
  'image_version_tag_assignments',
  {
    tagId: uuid('tag_id')
      .notNull()
      .references(() => projectTags.id, { onDelete: 'cascade' }),
    versionId: uuid('version_id')
      .notNull()
      .references(() => imageVersions.id, { onDelete: 'cascade' }),
    assignedBy: uuid('assigned_by')
      .notNull()
      .references(() => users.id),
    assignedAt: timestamp('assigned_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.tagId, table.versionId] }),
    index('image_version_tag_assignments_version_idx').on(table.versionId),
  ],
);

export type ProjectTag = typeof projectTags.$inferSelect;
export type NewProjectTag = typeof projectTags.$inferInsert;
export type AssetTagAssignment = typeof assetTagAssignments.$inferSelect;
export type ImageVersionTagAssignment =
  typeof imageVersionTagAssignments.$inferSelect;
