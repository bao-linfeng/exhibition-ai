import { and, desc, eq, lt } from 'drizzle-orm';
import type { Database } from '@exhibition/db';
import { designDirections, tasks, taskOutbox } from '@exhibition/db';
import { QUEUE_DESIGN_DIRECTION } from '../../infrastructure/queue.js';

export class DirectionRepository {
  constructor(private db: Database) {}

  async createTaskWithOutbox(input: {
    projectId: string;
    briefRevisionId: string;
    inputAssetIds: string[];
    count: number;
    requestedBy: string;
    idempotencyKey: string;
    inputSnapshot: Record<string, unknown>;
  }) {
    return this.db.transaction(async (tx) => {
      const [task] = await tx
        .insert(tasks)
        .values({
          projectId: input.projectId,
          kind: 'design_direction',
          idempotencyKey: input.idempotencyKey,
          inputSnapshot: input.inputSnapshot,
          requestedBy: input.requestedBy,
          status: 'pending',
          outputs: [],
          canCancel: true,
          canRetry: false,
        })
        .returning();
      if (!task) throw new Error('Failed to insert task');

      const [outboxRow] = await tx
        .insert(taskOutbox)
        .values({
          taskId: task.id,
          queueName: QUEUE_DESIGN_DIRECTION,
          payload: {
            taskId: task.id,
            projectId: input.projectId,
            outboxId: '__placeholder__',
          },
        })
        .returning();
      if (!outboxRow) throw new Error('Failed to insert outbox');

      const payload = {
        taskId: task.id,
        projectId: input.projectId,
        outboxId: outboxRow.id,
      };
      await tx
        .update(taskOutbox)
        .set({ payload })
        .where(eq(taskOutbox.id, outboxRow.id));
      return { task, outbox: { ...outboxRow, payload } };
    });
  }

  async bulkInsertDirections(
    rows: Array<{
      projectId: string;
      briefRevisionId: string;
      sourceTaskId: string;
      title: string;
      concept: string;
      layoutDescription: string;
      materialsAndColors: string;
      constraintsChecklist: string[];
      questionsForConfirmation: string[] | null;
      promptSnapshot: Record<string, unknown> | null;
      textUsage: Record<string, unknown> | null;
      createdBy: string;
    }>,
  ) {
    if (rows.length === 0) return [];
    return this.db
      .insert(designDirections)
      .values(
        rows.map((row) => ({
          ...row,
          questionsForConfirmation: row.questionsForConfirmation ?? null,
          promptSnapshot: row.promptSnapshot ?? null,
          textUsage: row.textUsage ?? null,
        })),
      )
      .returning();
  }

  async listByProject(opts: {
    projectId: string;
    briefRevisionId?: string;
    cursor?: string;
    limit?: number;
  }) {
    const limit = Math.min(Math.max(opts.limit ?? 20, 1), 50);
    const conditions = [eq(designDirections.projectId, opts.projectId)];
    if (opts.briefRevisionId)
      conditions.push(
        eq(designDirections.briefRevisionId, opts.briefRevisionId),
      );
    if (opts.cursor)
      conditions.push(
        lt(
          designDirections.createdAt,
          new Date(Buffer.from(opts.cursor, 'base64url').toString()),
        ),
      );
    const rows = await this.db
      .select()
      .from(designDirections)
      .where(and(...conditions))
      .orderBy(desc(designDirections.createdAt))
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

  async findByIdAndProject(id: string, projectId: string) {
    const [row] = await this.db
      .select()
      .from(designDirections)
      .where(
        and(
          eq(designDirections.id, id),
          eq(designDirections.projectId, projectId),
        ),
      )
      .limit(1);
    return row ?? null;
  }
}
