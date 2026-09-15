import { and, asc, desc, eq, isNull, lt, sql } from 'drizzle-orm';
import type { TaskOutput } from '@exhibition/contracts';
import type { Database, ImageVersion } from '@exhibition/db';
import { assets, imageVersions, projects, tasks } from '@exhibition/db';

export class ImageVersionRepository {
  constructor(private db: Database) {}

  async publishVersions(
    inputs: Array<{
      projectId: string;
      taskId: string;
      outputOrdinal: number;
      assetId: string;
      parentVersionId: string | null;
      briefRevisionId: string;
      width: number;
      height: number;
      sizeBytes: number;
      mimeType: string;
      createdBy: string;
    }>,
  ): Promise<ImageVersion[]> {
    if (inputs.length === 0) return [];

    const projectId = inputs[0]!.projectId;
    if (inputs.some((input) => input.projectId !== projectId)) {
      throw new Error(
        'All image version inputs must belong to the same project',
      );
    }

    return this.db.transaction(async (tx) => {
      const result = await tx.execute(
        sql<{
          id: string;
          next_version_sequence: number;
        }>`SELECT id, next_version_sequence FROM projects WHERE id = ${projectId} FOR UPDATE`,
      );
      const project = result.rows[0] as
        { id: string; next_version_sequence: number } | undefined;
      if (!project) throw new Error(`Project ${projectId} not found`);

      const rows = await tx
        .insert(imageVersions)
        .values(
          inputs.map((input, index) => ({
            ...input,
            sequence: project.next_version_sequence + index,
          })),
        )
        .returning();

      await tx
        .update(projects)
        .set({
          nextVersionSequence: project.next_version_sequence + inputs.length,
        })
        .where(eq(projects.id, projectId));

      return rows;
    });
  }

  async findById(id: string): Promise<ImageVersion | null> {
    const [row] = await this.db
      .select()
      .from(imageVersions)
      .where(eq(imageVersions.id, id));
    return row ?? null;
  }

  async findAssetLocation(
    id: string,
  ): Promise<{ bucket: string; objectKey: string } | null> {
    const [row] = await this.db
      .select({ bucket: assets.bucket, objectKey: assets.objectKey })
      .from(imageVersions)
      .innerJoin(assets, eq(imageVersions.assetId, assets.id))
      .where(eq(imageVersions.id, id));
    return row ?? null;
  }

  async listByProject(opts: {
    projectId: string;
    parentVersionId?: string | 'root';
    briefRevisionId?: string;
    includeHidden?: boolean;
    cursor?: string;
    limit?: number;
  }): Promise<{
    data: ImageVersion[];
    page: { nextCursor: string | null; hasMore: boolean };
  }> {
    const limit = Math.min(Math.max(opts.limit ?? 20, 1), 100);
    const conditions = [eq(imageVersions.projectId, opts.projectId)];

    if (!opts.includeHidden) conditions.push(isNull(imageVersions.hiddenAt));
    if (opts.parentVersionId === 'root') {
      conditions.push(isNull(imageVersions.parentVersionId));
    } else if (opts.parentVersionId) {
      conditions.push(eq(imageVersions.parentVersionId, opts.parentVersionId));
    }
    if (opts.briefRevisionId) {
      conditions.push(eq(imageVersions.briefRevisionId, opts.briefRevisionId));
    }
    if (opts.cursor) {
      conditions.push(
        lt(
          imageVersions.createdAt,
          new Date(Buffer.from(opts.cursor, 'base64url').toString()),
        ),
      );
    }

    const rows = await this.db
      .select()
      .from(imageVersions)
      .where(and(...conditions))
      .orderBy(desc(imageVersions.createdAt), asc(imageVersions.id))
      .limit(limit + 1);

    const hasMore = rows.length > limit;
    const data = hasMore ? rows.slice(0, limit) : rows;
    const last = data.at(-1);

    return {
      data,
      page: {
        hasMore,
        nextCursor:
          hasMore && last
            ? Buffer.from(last.createdAt.toISOString()).toString('base64url')
            : null,
      },
    };
  }

  async hideVersion(id: string): Promise<ImageVersion | null> {
    const [row] = await this.db
      .update(imageVersions)
      .set({ hiddenAt: new Date() })
      .where(eq(imageVersions.id, id))
      .returning();
    return row ?? null;
  }

  async updateSelectedVersion(
    projectId: string,
    versionId: string | null,
    expectedRevision: number,
  ): Promise<
    { selectedVersionId: string | null; revision: number } | 'conflict'
  > {
    const [row] = await this.db
      .update(projects)
      .set({
        selectedVersionId: versionId,
        revision: sql`${projects.revision} + 1`,
        updatedAt: sql`now()`,
      })
      .where(
        and(
          eq(projects.id, projectId),
          eq(projects.revision, expectedRevision),
        ),
      )
      .returning({
        selectedVersionId: projects.selectedVersionId,
        revision: projects.revision,
      });

    return row ?? 'conflict';
  }

  async updateTaskOutputs(
    taskId: string,
    outputs: TaskOutput[],
  ): Promise<void> {
    await this.db.update(tasks).set({ outputs }).where(eq(tasks.id, taskId));
  }
}
