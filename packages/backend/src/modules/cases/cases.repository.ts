import { and, desc, eq, ilike, lt, or, sql } from 'drizzle-orm';
import type { Database } from '@exhibition/db';
import {
  customers,
  projects,
  projectMembers,
  projectTags,
  assetTagAssignments,
  imageVersionTagAssignments,
  userImageVersionFavorites,
} from '@exhibition/db';

export interface CaseRow {
  id: string;
  name: string;
  customerId: string;
  customerName: string;
  archivedFromStatus: string | null;
  exhibitionName: string | null;
  exhibitionVenue: string | null;
  industry: string | null;
  selectedVersionId: string | null;
  approvedAt: Date | null;
  updatedAt: Date;
  createdAt: Date;
}

export class CasesRepository {
  constructor(private db: Database) {}

  async listCases(
    requestingUser: { id: string; role: string },
    opts: {
      search?: string;
      customerId?: string;
      tagId?: string;
      favorited?: boolean;
      cursor?: string;
      limit?: number;
    },
  ): Promise<{
    data: CaseRow[];
    page: { nextCursor: string | null; hasMore: boolean };
  }> {
    const limit = Math.min(Math.max(opts.limit ?? 20, 1), 100);
    const visibilityCondition =
      requestingUser.role === 'admin'
        ? sql`TRUE`
        : sql`EXISTS (
            SELECT 1 FROM ${projectMembers}
            WHERE ${projectMembers.projectId} = ${projects.id}
              AND ${projectMembers.userId} = ${requestingUser.id}
          )`;

    const conditions = [
      eq(projects.status, 'archived'),
      visibilityCondition,
      opts.search ? ilike(projects.name, `%${opts.search}%`) : undefined,
      opts.customerId ? eq(projects.customerId, opts.customerId) : undefined,
      opts.tagId
        ? sql`(
            EXISTS (
              SELECT 1 FROM ${assetTagAssignments} ata
              INNER JOIN ${projectTags} pt ON pt.id = ata.tag_id
              WHERE pt.project_id = ${projects.id}
                AND pt.id = ${opts.tagId}
            )
            OR EXISTS (
              SELECT 1 FROM ${imageVersionTagAssignments} ivta
              INNER JOIN ${projectTags} pt ON pt.id = ivta.tag_id
              WHERE pt.project_id = ${projects.id}
                AND pt.id = ${opts.tagId}
            )
          )`
        : undefined,
      opts.favorited === true
        ? sql`EXISTS (
            SELECT 1 FROM ${userImageVersionFavorites}
            WHERE ${userImageVersionFavorites.userId} = ${requestingUser.id}
              AND ${userImageVersionFavorites.versionId} = ${projects.selectedVersionId}
          )`
        : undefined,
    ].filter(Boolean);

    if (opts.cursor) {
      const { createdAt, id } = JSON.parse(
        Buffer.from(opts.cursor, 'base64url').toString(),
      ) as { createdAt: string; id: string };
      conditions.push(
        or(
          lt(projects.createdAt, new Date(createdAt)),
          and(eq(projects.createdAt, new Date(createdAt)), lt(projects.id, id)),
        )!,
      );
    }

    const rows = await this.db
      .select({
        id: projects.id,
        name: projects.name,
        customerId: projects.customerId,
        customerName: customers.name,
        archivedFromStatus: projects.archivedFromStatus,
        exhibitionName: projects.exhibitionName,
        exhibitionVenue: projects.exhibitionVenue,
        industry: projects.industry,
        selectedVersionId: projects.selectedVersionId,
        approvedAt: projects.approvedAt,
        updatedAt: projects.updatedAt,
        createdAt: projects.createdAt,
      })
      .from(projects)
      .innerJoin(customers, eq(projects.customerId, customers.id))
      .where(and(...(conditions as Parameters<typeof and>)))
      .orderBy(desc(projects.createdAt), desc(projects.id))
      .limit(limit + 1);

    const hasMore = rows.length > limit;
    const data = hasMore ? rows.slice(0, limit) : rows;
    const last = data.at(-1);
    const nextCursor =
      hasMore && last
        ? Buffer.from(
            JSON.stringify({
              createdAt: last.createdAt.toISOString(),
              id: last.id,
            }),
          ).toString('base64url')
        : null;

    return { data, page: { nextCursor, hasMore } };
  }

  async getTagsForProjects(
    projectIds: string[],
  ): Promise<
    Map<string, Array<{ id: string; name: string; color: string | null }>>
  > {
    if (projectIds.length === 0) return new Map();
    const rows = await this.db
      .select({
        projectId: projectTags.projectId,
        id: projectTags.id,
        name: projectTags.name,
        color: projectTags.color,
      })
      .from(projectTags)
      .where(
        sql`${projectTags.projectId} = ANY(${sql.raw(`ARRAY[${projectIds.map((id) => `'${id}'`).join(',')}]::uuid[]`)})`,
      );

    const map = new Map<
      string,
      Array<{ id: string; name: string; color: string | null }>
    >();
    for (const row of rows) {
      const list = map.get(row.projectId) ?? [];
      list.push({ id: row.id, name: row.name, color: row.color ?? null });
      map.set(row.projectId, list);
    }
    return map;
  }
}
