import type {
  ReconcileTaskRequest,
  RetryTaskRequest,
  TaskKind,
  TaskStatus,
  Task,
  TaskOutput,
} from '@exhibition/contracts';
import { logger } from '../../infrastructure/logger.js';
import type { TaskRepository } from './tasks.repository.js';
import type { Queue } from 'bullmq';

function toTaskDto(row: {
  id: string;
  projectId: string;
  kind: string;
  subtype: string | null;
  status: string;
  stage: string | null;
  progress: string | null;
  outputs: unknown;
  fee: unknown;
  errorCode: string | null;
  errorMessage: string | null;
  canCancel: boolean;
  canRetry: boolean;
  retryOfTaskId: string | null;
  requestedBy: string;
  createdAt: Date;
  startedAt: Date | null;
  finishedAt: Date | null;
}): Task {
  return {
    id: row.id,
    projectId: row.projectId,
    kind: row.kind as TaskKind,
    subtype: row.subtype,
    status: row.status as TaskStatus,
    stage: row.stage,
    progress: row.progress !== null ? parseFloat(row.progress) : null,
    outputs: (row.outputs as TaskOutput[] | null) ?? [],
    fee: (row.fee as Task['fee']) ?? null,
    errorCode: row.errorCode,
    errorMessage: row.errorMessage,
    canCancel: row.canCancel,
    canRetry: row.canRetry,
    retryOfTaskId: row.retryOfTaskId,
    requestedBy: row.requestedBy,
    createdAt: row.createdAt.toISOString(),
    startedAt: row.startedAt?.toISOString() ?? null,
    finishedAt: row.finishedAt?.toISOString() ?? null,
  };
}

export class TaskService {
  constructor(
    private repo: TaskRepository,
    private queues: Map<string, Queue>,
  ) {}

  async enqueueAssetValidation(input: {
    projectId: string;
    idempotencyKey: string;
    requestedBy: string;
    payload: Record<string, unknown>;
  }): Promise<Task | 'duplicate'> {
    const existing = await this.repo.findByIdempotencyKey(input.idempotencyKey);
    if (existing) return 'duplicate';

    const { task, outbox } = await this.repo.createWithOutbox({
      projectId: input.projectId,
      kind: 'asset_validation',
      idempotencyKey: input.idempotencyKey,
      requestedBy: input.requestedBy,
      queueName: 'exhibition-asset-validation',
      payload: input.payload,
    });

    // Relay outbox message to queue (best-effort; outbox scanner handles failures)
    await this.relayOutbox(
      outbox.id,
      outbox.taskId,
      outbox.queueName,
      outbox.payload as Record<string, unknown>,
    );

    return toTaskDto(task);
  }

  private async relayOutbox(
    outboxId: string,
    taskId: string,
    queueName: string,
    payload: Record<string, unknown>,
  ) {
    const queue = this.queues.get(queueName);
    if (!queue) return;

    try {
      await queue.add('process', payload, {
        jobId: outboxId,
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
      });
      await this.repo.markOutboxPublished(outboxId);
      await this.repo.markQueuedIfPending(taskId);
    } catch {
      await this.repo.incrementOutboxAttempt(outboxId);
    }
  }

  async getTask(
    id: string,
    requestingUserId: string,
    isAdmin: boolean,
    isMemberFn: (projectId: string) => Promise<boolean>,
  ): Promise<Task | 'not_found' | 'forbidden'> {
    const task = await this.repo.findById(id);
    if (!task) return 'not_found';

    if (!isAdmin && !(await isMemberFn(task.projectId))) return 'forbidden';

    return toTaskDto(task);
  }

  async listTasks(
    opts: {
      projectId?: string;
      kind?: TaskKind;
      status?: TaskStatus;
      cursor?: string;
      limit?: number;
    },
    requestingUserId: string,
    isAdmin: boolean,
    isMemberFn: (projectId: string) => Promise<boolean>,
  ): Promise<
    | { data: Task[]; page: { nextCursor: string | null; hasMore: boolean } }
    | 'forbidden'
  > {
    if (opts.projectId && !isAdmin) {
      const ok = await isMemberFn(opts.projectId);
      if (!ok) return 'forbidden';
    }

    const result = await this.repo.list(opts);
    return {
      data: result.data.map(toTaskDto),
      page: result.page,
    };
  }

  async cancelTask(
    id: string,
    requestingUserId: string,
    isAdmin: boolean,
    isMemberFn: (projectId: string) => Promise<boolean>,
  ): Promise<
    'ok' | 'not_found' | 'forbidden' | 'not_cancellable' | 'already_terminal'
  > {
    const task = await this.repo.findById(id);
    if (!task) return 'not_found';

    if (!isAdmin && !(await isMemberFn(task.projectId))) return 'forbidden';

    return this.repo.cancelIfCancellable(id);
  }

  async retryTask(
    id: string,
    requestingUserId: string,
    isAdmin: boolean,
    isMemberFn: (projectId: string) => Promise<boolean>,
    body: RetryTaskRequest,
  ): Promise<
    Task | 'not_found' | 'forbidden' | 'not_retryable' | 'unsupported_kind'
  > {
    const task = await this.repo.findById(id);
    if (!task) return 'not_found';

    if (!isAdmin && !(await isMemberFn(task.projectId))) return 'forbidden';
    if (!task.canRetry) return 'not_retryable';

    const outputs = (task.outputs as TaskOutput[] | null) ?? [];
    const failedOrdinals =
      body.failedOrdinals ??
      outputs
        .filter((output) => output.state === 'failed')
        .map((output) => output.ordinal);
    const retryableOutputs = outputs.filter((output) =>
      failedOrdinals.includes(output.ordinal),
    );

    if (
      failedOrdinals.length === 0 ||
      retryableOutputs.length !== failedOrdinals.length ||
      retryableOutputs.some((output) => output.state !== 'failed')
    ) {
      return 'not_retryable';
    }

    if (task.kind !== 'image_generation') return 'unsupported_kind';

    // SAFETY: Retry for image_generation is disabled until retry creation can atomically
    // reserve quota for the new outputs. Without a reservation, a retry task could call
    // the paid Provider, violating the accounting invariant.
    // See TODO-T019.md P0 item: "Fix image retry tasks so they cannot call a paid Provider without a reservation."
    return 'not_retryable';

    // const retryOutputs = retryableOutputs.map((output) => ({
    //   ...output,
    //   state: 'pending' as const,
    //   errorCode: null,
    //   errorMessage: null,
    // }));
    // const created = await this.repo.createRetryTask({
    //   originalTaskId: task.id,
    //   outputs: retryOutputs,
    //   queueName: 'exhibition-image-generation',
    //   payload: { projectId: task.projectId },
    // });

    // if (!created) return 'not_retryable';

    // await this.relayOutbox(
    //   created.outbox.id,
    //   created.task.id,
    //   created.outbox.queueName,
    //   created.outbox.payload as Record<string, unknown>,
    // );

    // return toTaskDto(created.task);
  }

  async reconcileTaskOutput(
    id: string,
    requestingUserId: string,
    isAdmin: boolean,
    isMemberFn: (projectId: string) => Promise<boolean>,
    body: ReconcileTaskRequest,
  ): Promise<
    Task | 'not_found' | 'forbidden' | 'not_reconciling' | 'ordinal_not_found'
  > {
    if (!isAdmin) return 'forbidden';

    const result = await this.repo.reconcileOutput({ taskId: id, ...body });
    return typeof result === 'string' ? result : toTaskDto(result);
  }

  async scanAndMarkStuckTasks(thresholdMs = 15 * 60 * 1000) {
    const stuckTasks = await this.repo.findStuckRunning(thresholdMs);
    if (stuckTasks.length === 0) return;

    const marked = await this.repo.markReconciling(
      stuckTasks.map((task) => task.id),
    );
    if (marked.length > 0) {
      logger.warn(
        { taskIds: marked.map((task) => task.id), thresholdMs },
        'Marked stuck tasks for reconciliation',
      );
    }
  }

  // Outbox relay scan — called periodically by worker scheduler
  async scanAndRelayOutbox() {
    const pending = await this.repo.findPendingOutbox(50);
    for (const entry of pending) {
      await this.relayOutbox(
        entry.id,
        entry.taskId,
        entry.queueName,
        entry.payload as Record<string, unknown>,
      );
    }
  }
}
