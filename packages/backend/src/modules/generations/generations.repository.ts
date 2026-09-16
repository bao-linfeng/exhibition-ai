import { and, desc, eq, lt } from 'drizzle-orm';
import type { Database } from '@exhibition/db';
import { generationRequests, taskOutbox, tasks } from '@exhibition/db';
import type { TaskFee, TaskKind, TaskOutput } from '@exhibition/contracts';
import type { QuotaRepository } from '../settings/quota.repository.js';
import { quotaPeriodDate } from '../settings/quota-period.js';

export class InsufficientQuotaError extends Error {
  constructor(message = 'Insufficient quota') {
    super(message);
  }
}

export class GenerationRepository {
  constructor(
    private db: Database,
    private quotaRepo: QuotaRepository,
  ) {}

  async findByIdempotencyKey(key: string) {
    const [row] = await this.db
      .select()
      .from(generationRequests)
      .where(eq(generationRequests.idempotencyKey, key));
    return row ?? null;
  }

  async findByTaskId(taskId: string) {
    const [row] = await this.db
      .select()
      .from(generationRequests)
      .where(eq(generationRequests.taskId, taskId));
    return row ?? null;
  }

  async createWithOutbox(input: {
    projectId: string;
    mode: string;
    briefRevisionId: string;
    directionId: string | null;
    parentVersionId: string | null;
    inputAssetIds: string[];
    instruction: string;
    modelConfigId: string;
    parameters: Record<string, unknown>;
    parametersHash: string;
    idempotencyKey: string;
    requestedBy: string;
    outputCount: number;
    modelSnapshot: {
      providerId: string;
      modelId: string;
      costPerImageMinor: number;
      currency: string;
    };
    estimatedFee: TaskFee;
  }) {
    return this.db.transaction(async (tx) => {
      const account = await this.quotaRepo.findOrCreateSystemAccountIn(
        tx,
        input.modelSnapshot.currency,
      );
      const periodDate = quotaPeriodDate();
      const inputSnapshot: Record<string, unknown> = {
        mode: input.mode,
        briefRevisionId: input.briefRevisionId,
        directionId: input.directionId,
        parentVersionId: input.parentVersionId,
        inputAssetIds: input.inputAssetIds,
        instruction: input.instruction,
        modelConfigId: input.modelConfigId,
        parameters: input.parameters,
        parametersHash: input.parametersHash,
        requestedAt: new Date().toISOString(),
        model: input.modelSnapshot,
        fee: input.estimatedFee,
        quota: {
          accountId: account.id,
          reservedAmountMinor: input.estimatedFee.amountMinor,
          currency: input.estimatedFee.currency,
          periodDate,
        },
      };
      const initialOutputs: TaskOutput[] = Array.from(
        { length: input.outputCount },
        (_, i) => ({
          ordinal: i,
          state: 'pending' as const,
          assetId: null,
          versionId: null,
          errorCode: null,
          errorMessage: null,
        }),
      );

      const [task] = await tx
        .insert(tasks)
        .values({
          projectId: input.projectId,
          kind: 'image_generation' as TaskKind,
          subtype: input.mode,
          idempotencyKey: input.idempotencyKey,
          inputSnapshot,
          fee: input.estimatedFee,
          requestedBy: input.requestedBy,
          status: 'pending',
          outputs: initialOutputs,
          canCancel: true,
          canRetry: false,
        })
        .returning();

      if (!task) throw new Error('Failed to insert task');

      const [genRequest] = await tx
        .insert(generationRequests)
        .values({
          taskId: task.id,
          projectId: input.projectId,
          mode: input.mode,
          briefRevisionId: input.briefRevisionId,
          directionId: input.directionId,
          parentVersionId: input.parentVersionId,
          inputAssetIds: input.inputAssetIds,
          instruction: input.instruction,
          modelConfigId: input.modelConfigId,
          parameters: input.parameters,
          parametersHash: input.parametersHash,
          idempotencyKey: input.idempotencyKey,
          requestedBy: input.requestedBy,
        })
        .returning();

      if (!genRequest) throw new Error('Failed to insert generation_request');

      const reservation = await this.quotaRepo.atomicReserve(
        tx,
        account.id,
        input.estimatedFee.amountMinor,
      );
      if (!reservation.ok) throw new InsufficientQuotaError();

      await this.quotaRepo.insertLedgerEntry(tx, {
        taskId: task.id,
        attemptOrdinal: null,
        accountId: account.id,
        entryType: 'reserve',
        feeStatus: 'estimated',
        amountMinor: input.estimatedFee.amountMinor,
        currency: input.estimatedFee.currency,
        provider: input.estimatedFee.provider,
        model: input.estimatedFee.model,
        providerUsage: null,
        periodDate,
      });

      const [outboxRow] = await tx
        .insert(taskOutbox)
        .values({
          taskId: task.id,
          queueName: 'exhibition-image-generation',
          payload: {
            taskId: task.id,
            projectId: input.projectId,
            outboxId: '__placeholder__',
          },
        })
        .returning();

      if (!outboxRow) throw new Error('Failed to insert outbox');

      const finalPayload = {
        taskId: task.id,
        projectId: input.projectId,
        outboxId: outboxRow.id,
      };
      await tx
        .update(taskOutbox)
        .set({ payload: finalPayload })
        .where(eq(taskOutbox.id, outboxRow.id));

      return {
        task,
        genRequest,
        outbox: { ...outboxRow, payload: finalPayload },
      };
    });
  }

  async listByProject(opts: {
    projectId: string;
    status?: string;
    cursor?: string;
    limit?: number;
  }) {
    const limit = Math.min(opts.limit ?? 20, 100);
    const conditions = [
      eq(tasks.projectId, opts.projectId),
      eq(tasks.kind, 'image_generation' as TaskKind),
    ];

    if (opts.cursor) {
      conditions.push(
        lt(
          tasks.createdAt,
          new Date(Buffer.from(opts.cursor, 'base64url').toString()),
        ),
      );
    }

    const rows = await this.db
      .select()
      .from(tasks)
      .where(and(...conditions))
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
}
