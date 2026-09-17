import { Type, type Static } from '@sinclair/typebox';
import {
  UuidSchema,
  DateTimeSchema,
  PaginationQuerySchema,
} from '../common/base.js';

// 收藏项（列出时返回）
export const AssetFavoriteSchema = Type.Object(
  {
    assetId: UuidSchema,
    projectId: UuidSchema,
    createdAt: DateTimeSchema,
  },
  { additionalProperties: false },
);

export const ImageVersionFavoriteSchema = Type.Object(
  {
    versionId: UuidSchema,
    projectId: UuidSchema,
    createdAt: DateTimeSchema,
  },
  { additionalProperties: false },
);

// GET /projects/:projectId/favorites/assets
export const ListAssetFavoritesQuerySchema = PaginationQuerySchema;

export const ListAssetFavoritesResponseSchema = Type.Object(
  {
    data: Type.Array(AssetFavoriteSchema),
    page: Type.Object(
      {
        nextCursor: Type.Union([Type.String(), Type.Null()]),
        hasMore: Type.Boolean(),
      },
      { additionalProperties: false },
    ),
  },
  { additionalProperties: false },
);

// GET /projects/:projectId/favorites/versions
export const ListImageVersionFavoritesQuerySchema = PaginationQuerySchema;

export const ListImageVersionFavoritesResponseSchema = Type.Object(
  {
    data: Type.Array(ImageVersionFavoriteSchema),
    page: Type.Object(
      {
        nextCursor: Type.Union([Type.String(), Type.Null()]),
        hasMore: Type.Boolean(),
      },
      { additionalProperties: false },
    ),
  },
  { additionalProperties: false },
);

// 类型导出
export type AssetFavorite = Static<typeof AssetFavoriteSchema>;
export type ImageVersionFavorite = Static<typeof ImageVersionFavoriteSchema>;
