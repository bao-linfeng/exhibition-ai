import { and, desc, eq, lt, or, sql } from 'drizzle-orm';
import type { Database } from '@exhibition/db';
import { userAssetFavorites, userImageVersionFavorites } from '@exhibition/db';

export class FavoriteRepository {
  constructor(private db: Database) {}

  async setAssetFavorite(userId: string, assetId: string, projectId: string) {
    await this.db
      .insert(userAssetFavorites)
      .values({ userId, assetId, projectId })
      .onConflictDoNothing();
  }

  async unsetAssetFavorite(userId: string, assetId: string) {
    await this.db
      .delete(userAssetFavorites)
      .where(
        and(
          eq(userAssetFavorites.userId, userId),
          eq(userAssetFavorites.assetId, assetId),
        ),
      );
  }

  async isAssetFavorited(userId: string, assetId: string): Promise<boolean> {
    const [row] = await this.db
      .select({ assetId: userAssetFavorites.assetId })
      .from(userAssetFavorites)
      .where(
        and(
          eq(userAssetFavorites.userId, userId),
          eq(userAssetFavorites.assetId, assetId),
        ),
      )
      .limit(1);
    return row !== undefined;
  }

  async listAssetFavorites(
    userId: string,
    projectId: string,
    opts: { cursor?: string; limit?: number },
  ) {
    const limit = Math.min(Math.max(opts.limit ?? 20, 1), 100);
    const conditions = [
      eq(userAssetFavorites.userId, userId),
      eq(userAssetFavorites.projectId, projectId),
    ];

    if (opts.cursor) {
      const { createdAt, assetId } = JSON.parse(
        Buffer.from(opts.cursor, 'base64url').toString(),
      ) as { createdAt: string; assetId: string };
      conditions.push(
        or(
          lt(userAssetFavorites.createdAt, new Date(createdAt)),
          and(
            eq(userAssetFavorites.createdAt, new Date(createdAt)),
            lt(userAssetFavorites.assetId, assetId),
          ),
        )!,
      );
    }

    const rows = await this.db
      .select()
      .from(userAssetFavorites)
      .where(and(...conditions))
      .orderBy(
        desc(userAssetFavorites.createdAt),
        desc(userAssetFavorites.assetId),
      )
      .limit(limit + 1);

    const hasMore = rows.length > limit;
    const data = hasMore ? rows.slice(0, limit) : rows;
    const last = data.at(-1);
    const nextCursor =
      hasMore && last
        ? Buffer.from(
            JSON.stringify({
              createdAt: last.createdAt.toISOString(),
              assetId: last.assetId,
            }),
          ).toString('base64url')
        : null;

    return { data, page: { nextCursor, hasMore } };
  }

  async setVersionFavorite(
    userId: string,
    versionId: string,
    projectId: string,
  ) {
    await this.db
      .insert(userImageVersionFavorites)
      .values({ userId, versionId, projectId })
      .onConflictDoNothing();
  }

  async unsetVersionFavorite(userId: string, versionId: string) {
    await this.db
      .delete(userImageVersionFavorites)
      .where(
        and(
          eq(userImageVersionFavorites.userId, userId),
          eq(userImageVersionFavorites.versionId, versionId),
        ),
      );
  }

  async isVersionFavorited(
    userId: string,
    versionId: string,
  ): Promise<boolean> {
    const [row] = await this.db
      .select({ versionId: userImageVersionFavorites.versionId })
      .from(userImageVersionFavorites)
      .where(
        and(
          eq(userImageVersionFavorites.userId, userId),
          eq(userImageVersionFavorites.versionId, versionId),
        ),
      )
      .limit(1);
    return row !== undefined;
  }

  async listVersionFavorites(
    userId: string,
    projectId: string,
    opts: { cursor?: string; limit?: number },
  ) {
    const limit = Math.min(Math.max(opts.limit ?? 20, 1), 100);
    const conditions = [
      eq(userImageVersionFavorites.userId, userId),
      eq(userImageVersionFavorites.projectId, projectId),
    ];

    if (opts.cursor) {
      const { createdAt, versionId } = JSON.parse(
        Buffer.from(opts.cursor, 'base64url').toString(),
      ) as { createdAt: string; versionId: string };
      conditions.push(
        or(
          lt(userImageVersionFavorites.createdAt, new Date(createdAt)),
          and(
            eq(userImageVersionFavorites.createdAt, new Date(createdAt)),
            lt(userImageVersionFavorites.versionId, versionId),
          ),
        )!,
      );
    }

    const rows = await this.db
      .select()
      .from(userImageVersionFavorites)
      .where(and(...conditions))
      .orderBy(
        desc(userImageVersionFavorites.createdAt),
        desc(userImageVersionFavorites.versionId),
      )
      .limit(limit + 1);

    const hasMore = rows.length > limit;
    const data = hasMore ? rows.slice(0, limit) : rows;
    const last = data.at(-1);
    const nextCursor =
      hasMore && last
        ? Buffer.from(
            JSON.stringify({
              createdAt: last.createdAt.toISOString(),
              versionId: last.versionId,
            }),
          ).toString('base64url')
        : null;

    return { data, page: { nextCursor, hasMore } };
  }

  async isVersionFavoritedBatch(
    userId: string,
    versionIds: string[],
  ): Promise<Set<string>> {
    if (versionIds.length === 0) return new Set();
    const rows = await this.db
      .select({ versionId: userImageVersionFavorites.versionId })
      .from(userImageVersionFavorites)
      .where(
        and(
          eq(userImageVersionFavorites.userId, userId),
          sql`${userImageVersionFavorites.versionId} = ANY(${sql.raw(`ARRAY[${versionIds.map((id) => `'${id}'`).join(',')}]::uuid[]`)})`,
        ),
      );
    return new Set(rows.map((row) => row.versionId));
  }
}
