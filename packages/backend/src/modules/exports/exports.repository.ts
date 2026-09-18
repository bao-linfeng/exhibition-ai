import { and, desc, eq, inArray, isNotNull, lt } from 'drizzle-orm';
import {
  exportRecords,
  imageVersions,
  taskOutbox,
  type Database,
  type ExportRecord,
} from '@exhibition/db';

type DatabaseTransaction = Parameters<
  Parameters<Database['transaction']>[0]
>[0];

export class ExportRepository {
  constructor(private db: Database) {}

  async create(input: {
    projectId: string;
    taskId: string;
    format: string;
    versionIds: string[];
    createdBy: string;
    expiresAt: Date;
  }): Promise<ExportRecord> {
    const [row] = await this.db.insert(exportRecords).values(input).returning();
    if (!row) throw new Error('Failed to create export record');
    return row;
  }

  async createInTx(
    tx: DatabaseTransaction,
    input: {
      projectId: string;
      taskId: string;
      format: string;
      versionIds: string[];
      createdBy: string;
      expiresAt: Date;
    },
  ): Promise<ExportRecord> {
    const [row] = await tx.insert(exportRecords).values(input).returning();
    if (!row) throw new Error('Failed to create export record');
    return row;
  }

  async findById(id: string): Promise<ExportRecord | null> {
    const [row] = await this.db
      .select()
      .from(exportRecords)
      .where(eq(exportRecords.id, id));
    return row ?? null;
  }

  async findByTaskId(taskId: string): Promise<ExportRecord | null> {
    const [row] = await this.db
      .select()
      .from(exportRecords)
      .where(eq(exportRecords.taskId, taskId));
    return row ?? null;
  }

  async updateOutboxPayload(id: string, payload: Record<string, unknown>) {
    await this.db
      .update(taskOutbox)
      .set({ payload })
      .where(eq(taskOutbox.id, id));
  }

  async updateOutboxPayloadInTx(
    tx: DatabaseTransaction,
    id: string,
    payload: Record<string, unknown>,
  ) {
    await tx.update(taskOutbox).set({ payload }).where(eq(taskOutbox.id, id));
  }

  async updateStatus(
    id: string,
    status: string,
    extra?: {
      resultAssetId?: string;
      errorMessage?: string;
      finishedAt?: Date;
    },
  ): Promise<ExportRecord | null> {
    const [row] = await this.db
      .update(exportRecords)
      .set({
        status,
        ...(extra?.resultAssetId !== undefined
          ? { resultAssetId: extra.resultAssetId }
          : {}),
        ...(extra?.errorMessage !== undefined
          ? { errorMessage: extra.errorMessage }
          : {}),
        ...(extra?.finishedAt !== undefined
          ? { finishedAt: extra.finishedAt }
          : {}),
      })
      .where(eq(exportRecords.id, id))
      .returning();
    return row ?? null;
  }

  async list(opts: {
    projectId: string;
    cursor?: string;
    limit?: number;
  }): Promise<{
    data: ExportRecord[];
    page: { nextCursor: string | null; hasMore: boolean };
  }> {
    const limit = Math.min(Math.max(opts.limit ?? 20, 1), 100);
    const conditions = [eq(exportRecords.projectId, opts.projectId)];
    if (opts.cursor) {
      conditions.push(
        lt(
          exportRecords.createdAt,
          new Date(Buffer.from(opts.cursor, 'base64url').toString()),
        ),
      );
    }

    const rows = await this.db
      .select()
      .from(exportRecords)
      .where(and(...conditions))
      .orderBy(desc(exportRecords.createdAt))
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

  async findExpiredWithAsset(olderThan: Date): Promise<ExportRecord[]> {
    return this.db
      .select()
      .from(exportRecords)
      .where(
        and(
          lt(exportRecords.expiresAt, olderThan),
          isNotNull(exportRecords.resultAssetId),
        ),
      );
  }

  async validateVersionsBelongToProject(
    versionIds: string[],
    projectId: string,
  ): Promise<boolean> {
    if (versionIds.length === 0) return false;
    const rows = await this.db
      .select({ id: imageVersions.id })
      .from(imageVersions)
      .where(
        and(
          eq(imageVersions.projectId, projectId),
          inArray(imageVersions.id, versionIds),
        ),
      );
    return rows.length === versionIds.length;
  }
}
