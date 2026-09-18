import { and, desc, eq, inArray, lt, sql } from 'drizzle-orm';
import type { Database } from '@exhibition/db';
import { tasks, taskOutbox } from '@exhibition/db';
import type {
  TaskFee,
  TaskKind,
  TaskOutput,
  TaskStatus,
} from '@exhibition/contracts';
import type { QuotaRepository } from '../settings/quota.repository.js';
import { quotaPeriodDate } from '../settings/quota-period.js';

export class InsufficientQuotaError extends Error {
  constructor(message = 'Insufficient quota for retry') {
    super(message);
  }
}

export class TaskRepository {
  constructor(
    private db: Database,
    private quotaRepo: QuotaRepository,
  ) {}

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

  async createRetryTask(input: {
    originalTaskId: string;
    outputs: TaskOutput[];
    queueName: string;
    payload: Record<string, unknown>;
    quota: {
      estimatedAmountMinor: number;
      currency: string;
      provider: string;
      model: string;
    };
  }) {
    return this.db.transaction(async (tx) => {
      const [originalTask] = await tx
        .select()
        .from(tasks)
        .where(eq(tasks.id, input.originalTaskId));

      if (!originalTask) return null;

      const [retryDisabled] = await tx
        .update(tasks)
        .set({ canRetry: false })
        .where(
          and(eq(tasks.id, input.originalTaskId), eq(tasks.canRetry, true)),
        )
        .returning({ id: tasks.id });

      if (!retryDisabled) return null;

      const [task] = await tx
        .insert(tasks)
        .values({
          projectId: originalTask.projectId,
          kind: originalTask.kind,
          subtype: originalTask.subtype,
          inputSnapshot: originalTask.inputSnapshot,
          requestedBy: originalTask.requestedBy,
          retryOfTaskId: originalTask.id,
          status: 'pending',
          outputs: input.outputs,
        })
        .returning();

      if (!task) throw new Error('Failed to insert retry task');

      // Atomically reserve quota for the new retry task before enqueuing.
      // This ensures the worker can settle the task without violating accounting invariants.
      const account = await this.quotaRepo.findOrCreateSystemAccountIn(
        tx,
        input.quota.currency,
      );
      const reservation = await this.quotaRepo.atomicReserve(
        tx,
        account.id,
        input.quota.estimatedAmountMinor,
      );
      if (!reservation.ok) throw new InsufficientQuotaError();

      await this.quotaRepo.insertLedgerEntry(tx, {
        taskId: task.id,
        attemptOrdinal: null,
        accountId: account.id,
        entryType: 'reserve',
        feeStatus: 'estimated',
        amountMinor: input.quota.estimatedAmountMinor,
        currency: input.quota.currency,
        provider: input.quota.provider,
        model: input.quota.model,
        providerUsage: null,
        periodDate: quotaPeriodDate(),
      });

      const [outbox] = await tx
        .insert(taskOutbox)
        .values({
          taskId: task.id,
          queueName: input.queueName,
          payload: {
            ...input.payload,
            taskId: task.id,
            outboxId: '__placeholder__',
          },
        })
        .returning();

      if (!outbox) throw new Error('Failed to insert retry outbox');

      const payload = {
        ...input.payload,
        taskId: task.id,
        outboxId: outbox.id,
      };
      await tx
        .update(taskOutbox)
        .set({ payload })
        .where(eq(taskOutbox.id, outbox.id));

      return { task, outbox: { ...outbox, payload } };
    });
  }

  async findById(id: string) {
    const [row] = await this.db.select().from(tasks).where(eq(tasks.id, id));
    return row ?? null;
  }

  async claimForExecution(taskId: string) {
    const [task] = await this.db
      .update(tasks)
      .set({
        status: 'running',
        startedAt: new Date(),
        canCancel: false,
      })
      .where(
        and(eq(tasks.id, taskId), inArray(tasks.status, ['pending', 'queued'])),
      )
      .returning();
    return task ?? null;
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
    projectIds?: string[];
    kind?: TaskKind;
    status?: TaskStatus;
    cursor?: string;
    limit?: number;
  }) {
    const limit = Math.min(opts.limit ?? 20, 100);

    const conditions = [];
    if (opts.projectId) conditions.push(eq(tasks.projectId, opts.projectId));
    if (opts.projectIds) {
      conditions.push(
        opts.projectIds.length > 0
          ? inArray(tasks.projectId, opts.projectIds)
          : sql`false`,
      );
    }
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

    const [updated] = await this.db
      .update(tasks)
      .set({
        status: 'cancelled',
        finishedAt: new Date(),
        canCancel: false,
        canRetry: true,
      })
      .where(
        and(
          eq(tasks.id, id),
          eq(tasks.canCancel, true),
          sql`${tasks.status} NOT IN ('succeeded', 'partially_succeeded', 'failed', 'cancelled')`,
        ),
      )
      .returning({ id: tasks.id });

    if (updated) return 'ok';

    const recheck = await this.findById(id);
    if (!recheck) return 'not_found';
    if (terminal.includes(recheck.status)) return 'already_terminal';
    return 'not_cancellable';
  }

  async findStuckRunning(thresholdMs: number) {
    return this.db
      .select({ id: tasks.id, kind: tasks.kind })
      .from(tasks)
      .where(
        and(
          eq(tasks.status, 'running'),
          lt(tasks.startedAt, new Date(Date.now() - thresholdMs)),
        ),
      );
  }

  async markReconciling(ids: string[]) {
    if (ids.length === 0) return [];

    return this.db
      .update(tasks)
      .set({ status: 'reconciling' })
      .where(and(inArray(tasks.id, ids), eq(tasks.status, 'running')))
      .returning({ id: tasks.id });
  }

  async markTaskReconciling(id: string) {
    const [task] = await this.db
      .update(tasks)
      .set({ status: 'reconciling', canCancel: false, canRetry: false })
      .where(and(eq(tasks.id, id), eq(tasks.status, 'running')))
      .returning();
    return task ?? null;
  }

  async markQueuedIfPending(id: string) {
    const [task] = await this.db
      .update(tasks)
      .set({ status: 'queued' })
      .where(and(eq(tasks.id, id), eq(tasks.status, 'pending')))
      .returning({ id: tasks.id });
    return task ?? null;
  }

  async reconcileOutput(input: {
    taskId: string;
    ordinal: number;
    outcome: 'succeeded' | 'failed' | 'cancelled';
    actualFee?: TaskFee;
    reason: string;
  }) {
    return this.db.transaction(async (tx) => {
      const [task] = await tx
        .select()
        .from(tasks)
        .where(eq(tasks.id, input.taskId));

      if (!task) return 'not_found' as const;
      if (task.status !== 'reconciling') return 'not_reconciling' as const;

      const outputs = (task.outputs as TaskOutput[] | null) ?? [];
      const outputIndex = outputs.findIndex(
        (output) => output.ordinal === input.ordinal,
      );
      if (outputIndex === -1) return 'ordinal_not_found' as const;

      const nextOutputs = outputs.map((output) =>
        output.ordinal === input.ordinal
          ? { ...output, state: input.outcome }
          : output,
      );
      const terminalStates = new Set(['succeeded', 'failed', 'cancelled']);
      const allTerminal = nextOutputs.every((output) =>
        terminalStates.has(output.state),
      );
      const succeededCount = nextOutputs.filter(
        (output) => output.state === 'succeeded',
      ).length;
      const failedCount = nextOutputs.filter(
        (output) => output.state === 'failed',
      ).length;
      const cancelledCount = nextOutputs.filter(
        (output) => output.state === 'cancelled',
      ).length;
      const status = allTerminal
        ? succeededCount === nextOutputs.length
          ? 'succeeded'
          : cancelledCount === nextOutputs.length
            ? 'cancelled'
            : succeededCount > 0
              ? 'partially_succeeded'
              : 'failed'
        : 'reconciling';

      const [updated] = await tx
        .update(tasks)
        .set({
          outputs: nextOutputs,
          status,
          ...(allTerminal
            ? {
                finishedAt: new Date(),
                canRetry: failedCount > 0,
                canCancel: false,
              }
            : {}),
          ...(input.actualFee !== undefined ? { fee: input.actualFee } : {}),
        })
        .where(and(eq(tasks.id, input.taskId), eq(tasks.status, 'reconciling')))
        .returning();

      return updated ?? ('not_reconciling' as const);
    });
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
