import { eq, and, desc, lt, sql } from 'drizzle-orm';
import type { Database } from '@exhibition/db';
import { tasks, taskOutbox } from '@exhibition/db';
import type { TaskKind, TaskStatus } from '@exhibition/contracts';

export class TaskRepository {
  constructor(private db: Database) {}

  async createWithOutbox(input: {
    projectId: string;
    kind: TaskKind;
    subtype?: string;
    idempotencyKey?: string;
    inputSnapshot?: unknown;
    requestedBy: string;
    queueName: string;
    payload: Record<string, unknown>;
  }) {
    return this.db.transaction(async (tx) => {
      const [task] = await tx
        .insert(tasks)
        .values({
          projectId: input.projectId,
          kind: input.kind,
          subtype: input.subtype ?? null,
          idempotencyKey: input.idempotencyKey ?? null,
          inputSnapshot: input.inputSnapshot ?? null,
          requestedBy: input.requestedBy,
          status: 'pending',
          outputs: [],
        })
        .returning();

      if (!task) throw new Error('Failed to insert task');

      const [outbox] = await tx
        .insert(taskOutbox)
        .values({
          taskId: task.id,
          queueName: input.queueName,
          payload: { ...input.payload, taskId: task.id },
        })
        .returning();

      if (!outbox) throw new Error('Failed to insert outbox');

      return { task, outbox };
    });
  }

  async findById(id: string) {
    const [row] = await this.db.select().from(tasks).where(eq(tasks.id, id));
    return row ?? null;
  }

  async findByIdempotencyKey(key: string) {
    const [row] = await this.db
      .select()
      .from(tasks)
      .where(eq(tasks.idempotencyKey, key));
    return row ?? null;
  }

  async updateInputSnapshot(id: string, inputSnapshot: unknown) {
    await this.db.update(tasks).set({ inputSnapshot }).where(eq(tasks.id, id));
  }

  async list(opts: {
    projectId?: string;
    kind?: TaskKind;
    status?: TaskStatus;
    cursor?: string;
    limit?: number;
  }) {
    const limit = Math.min(opts.limit ?? 20, 100);

    const conditions = [];
    if (opts.projectId) conditions.push(eq(tasks.projectId, opts.projectId));
    if (opts.kind) conditions.push(eq(tasks.kind, opts.kind));
    if (opts.status) conditions.push(eq(tasks.status, opts.status));
    if (opts.cursor)
      conditions.push(
        lt(
          tasks.createdAt,
          new Date(Buffer.from(opts.cursor, 'base64url').toString()),
        ),
      );

    const rows = await this.db
      .select()
      .from(tasks)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(tasks.createdAt))
      .limit(limit + 1);

    const hasMore = rows.length > limit;
    const data = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor =
      hasMore && data.length > 0
        ? Buffer.from(data[data.length - 1]!.createdAt.toISOString()).toString(
            'base64url',
          )
        : null;

    return { data, page: { nextCursor, hasMore } };
  }

  async updateStatus(
    id: string,
    status: TaskStatus,
    extra?: {
      startedAt?: Date;
      finishedAt?: Date;
      errorCode?: string;
      errorMessage?: string;
      canCancel?: boolean;
      canRetry?: boolean;
    },
  ) {
    const [row] = await this.db
      .update(tasks)
      .set({
        status,
        ...(extra?.startedAt !== undefined
          ? { startedAt: extra.startedAt }
          : {}),
        ...(extra?.finishedAt !== undefined
          ? { finishedAt: extra.finishedAt }
          : {}),
        ...(extra?.errorCode !== undefined
          ? { errorCode: extra.errorCode }
          : {}),
        ...(extra?.errorMessage !== undefined
          ? { errorMessage: extra.errorMessage }
          : {}),
        ...(extra?.canCancel !== undefined
          ? { canCancel: extra.canCancel }
          : {}),
        ...(extra?.canRetry !== undefined ? { canRetry: extra.canRetry } : {}),
      })
      .where(eq(tasks.id, id))
      .returning();
    return row ?? null;
  }

  async cancelIfCancellable(
    id: string,
  ): Promise<'ok' | 'not_found' | 'not_cancellable' | 'already_terminal'> {
    const task = await this.findById(id);
    if (!task) return 'not_found';

    const terminal = [
      'succeeded',
      'partially_succeeded',
      'failed',
      'cancelled',
    ];
    if (terminal.includes(task.status)) return 'already_terminal';
    if (!task.canCancel) return 'not_cancellable';

    await this.db
      .update(tasks)
      .set({
        status: 'cancelled',
        finishedAt: new Date(),
        canCancel: false,
        canRetry: true,
      })
      .where(and(eq(tasks.id, id), eq(tasks.canCancel, true)));

    return 'ok';
  }

  // Outbox: pick unpublished messages for relay
  async findPendingOutbox(limit = 50) {
    return this.db
      .select()
      .from(taskOutbox)
      .where(
        and(
          eq(taskOutbox.published, false),
          lt(taskOutbox.nextAttemptAt, new Date()),
        ),
      )
      .orderBy(taskOutbox.nextAttemptAt)
      .limit(limit);
  }

  async markOutboxPublished(id: string) {
    await this.db
      .update(taskOutbox)
      .set({ published: true, publishedAt: new Date() })
      .where(eq(taskOutbox.id, id));
  }

  async incrementOutboxAttempt(id: string, nextAttemptDelayMs = 30_000) {
    await this.db
      .update(taskOutbox)
      .set({
        attempts: sql`${taskOutbox.attempts} + 1`,
        nextAttemptAt: new Date(Date.now() + nextAttemptDelayMs),
      })
      .where(eq(taskOutbox.id, id));
  }
}
