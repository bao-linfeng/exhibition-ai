import { and, desc, eq, lt, sql } from 'drizzle-orm';
import type { BriefContent } from '@exhibition/contracts';
import type { Database } from '@exhibition/db';
import { briefRevisions, projects } from '@exhibition/db';

export class BriefRepository {
  constructor(private db: Database) {}

  async findProjectRevision(projectId: string): Promise<number | null> {
    const [project] = await this.db
      .select({ revision: projects.revision })
      .from(projects)
      .where(eq(projects.id, projectId))
      .limit(1);

    return project?.revision ?? null;
  }

  async findCurrentByProjectId(
    projectId: string,
  ): Promise<typeof briefRevisions.$inferSelect | null> {
    const [project] = await this.db
      .select({ currentBriefRevisionId: projects.currentBriefRevisionId })
      .from(projects)
      .where(eq(projects.id, projectId))
      .limit(1);

    if (!project?.currentBriefRevisionId) return null;

    const [revision] = await this.db
      .select()
      .from(briefRevisions)
      .where(eq(briefRevisions.id, project.currentBriefRevisionId))
      .limit(1);

    return revision ?? null;
  }

  async findById(
    id: string,
  ): Promise<typeof briefRevisions.$inferSelect | null> {
    const [revision] = await this.db
      .select()
      .from(briefRevisions)
      .where(eq(briefRevisions.id, id))
      .limit(1);

    return revision ?? null;
  }

  async findByProjectId(
    revisionId: string,
    projectId: string,
  ): Promise<typeof briefRevisions.$inferSelect | null> {
    const [revision] = await this.db
      .select()
      .from(briefRevisions)
      .where(
        and(
          eq(briefRevisions.id, revisionId),
          eq(briefRevisions.projectId, projectId),
        ),
      )
      .limit(1);

    return revision ?? null;
  }

  async listByProjectId(
    projectId: string,
    opts: { cursor?: string; limit?: number },
  ): Promise<{
    data: (typeof briefRevisions.$inferSelect)[];
    page: { nextCursor: string | null; hasMore: boolean };
  }> {
    const limit = Math.min(Math.max(opts.limit ?? 20, 1), 50);
    const rows = await this.db
      .select()
      .from(briefRevisions)
      .where(
        and(
          eq(briefRevisions.projectId, projectId),
          opts.cursor
            ? lt(briefRevisions.createdAt, new Date(opts.cursor))
            : undefined,
        ),
      )
      .orderBy(desc(briefRevisions.number))
      .limit(limit + 1);

    const hasMore = rows.length > limit;
    const data = hasMore ? rows.slice(0, limit) : rows;
    const last = data.at(-1);

    return {
      data,
      page: {
        hasMore,
        nextCursor: hasMore && last ? last.createdAt.toISOString() : null,
      },
    };
  }

  async createRevision(params: {
    projectId: string;
    content: BriefContent;
    createdBy: string;
    expectedRevision: number;
  }): Promise<typeof briefRevisions.$inferSelect | 'conflict' | 'not_found'> {
    return this.db.transaction(async (tx) => {
      const [project] = await tx
        .select({
          id: projects.id,
          revision: projects.revision,
          currentBriefRevisionId: projects.currentBriefRevisionId,
        })
        .from(projects)
        .where(eq(projects.id, params.projectId))
        .limit(1);

      if (!project) return 'not_found';
      if (project.revision !== params.expectedRevision) return 'conflict';

      const [maxRow] = await tx
        .select({
          maxNumber: sql<number>`coalesce(max(${briefRevisions.number}), 0)`,
        })
        .from(briefRevisions)
        .where(eq(briefRevisions.projectId, params.projectId));
      const nextNumber = (maxRow?.maxNumber ?? 0) + 1;

      const [newRevision] = await tx
        .insert(briefRevisions)
        .values({
          projectId: params.projectId,
          number: nextNumber,
          content: params.content as unknown as Record<string, unknown>,
          createdBy: params.createdBy,
        })
        .returning();

      if (!newRevision) throw new Error('Failed to insert brief revision');

      const [updatedProject] = await tx
        .update(projects)
        .set({
          currentBriefRevisionId: newRevision.id,
          updatedAt: new Date(),
          revision: sql`${projects.revision} + 1`,
        })
        .where(
          and(
            eq(projects.id, params.projectId),
            eq(projects.revision, params.expectedRevision),
          ),
        )
        .returning({ id: projects.id });

      if (!updatedProject) return 'conflict';

      return newRevision;
    });
  }

  async confirmRevision(params: {
    projectId: string;
    revisionId: string;
    confirmedBy: string;
    expectedRevision: number;
  }): Promise<
    | typeof briefRevisions.$inferSelect
    | 'conflict'
    | 'not_found'
    | 'wrong_revision'
  > {
    return this.db.transaction(async (tx) => {
      const [project] = await tx
        .select({
          revision: projects.revision,
          currentBriefRevisionId: projects.currentBriefRevisionId,
        })
        .from(projects)
        .where(eq(projects.id, params.projectId))
        .limit(1);

      if (!project) return 'not_found';
      if (project.revision !== params.expectedRevision) return 'conflict';

      const [revision] = await tx
        .select()
        .from(briefRevisions)
        .where(
          and(
            eq(briefRevisions.id, params.revisionId),
            eq(briefRevisions.projectId, params.projectId),
          ),
        )
        .limit(1);

      if (!revision) return 'not_found';
      if (project.currentBriefRevisionId !== params.revisionId) {
        return 'wrong_revision';
      }

      const now = new Date();
      const [confirmedRevision] = await tx
        .update(briefRevisions)
        .set({ confirmedBy: params.confirmedBy, confirmedAt: now })
        .where(eq(briefRevisions.id, params.revisionId))
        .returning();

      if (!confirmedRevision) {
        throw new Error('Failed to confirm brief revision');
      }

      await tx
        .update(projects)
        .set({ updatedAt: now, revision: sql`${projects.revision} + 1` })
        .where(
          and(
            eq(projects.id, params.projectId),
            eq(projects.revision, params.expectedRevision),
          ),
        );

      return confirmedRevision;
    });
  }
}
