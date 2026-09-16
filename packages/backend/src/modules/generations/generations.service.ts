import { createHash } from 'node:crypto';
import type { Queue } from 'bullmq';
import type {
  CreateGenerationRequest,
  GenerationTaskSummary,
  TaskOutput,
} from '@exhibition/contracts';
import type { TaskRepository } from '../tasks/tasks.repository.js';
import { env } from '../../infrastructure/index.js';
import type { ModelConfigRepository } from '../settings/model-config.repository.js';
import {
  GenerationRepository,
  InsufficientQuotaError,
} from './generations.repository.js';

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nested]) => [key, canonicalize(nested)]),
    );
  }
  return value;
}

function hashExecutionInput(input: Record<string, unknown>): string {
  return createHash('sha256')
    .update(JSON.stringify(canonicalize(input)))
    .digest('hex');
}

function toGenerationSummary(row: {
  id: string;
  projectId: string;
  subtype: string | null;
  status: string;
  stage: string | null;
  progress: string | null;
  outputs: unknown;
  requestedBy: string;
  createdAt: Date;
  startedAt: Date | null;
  finishedAt: Date | null;
}): GenerationTaskSummary {
  const outputs = (row.outputs as TaskOutput[] | null) ?? [];
  return {
    id: row.id,
    projectId: row.projectId,
    mode: row.subtype === 'edit' ? 'edit' : 'generate',
    status: row.status as GenerationTaskSummary['status'],
    stage: row.stage ?? undefined,
    progress: row.progress !== null ? parseFloat(row.progress) : null,
    totalOutputs: Math.max(outputs.length, 1),
    succeededOutputs: outputs.filter((output) => output.state === 'succeeded')
      .length,
    failedOutputs: outputs.filter((output) => output.state === 'failed').length,
    createdBy: row.requestedBy,
    createdAt: row.createdAt.toISOString(),
    startedAt: row.startedAt?.toISOString() ?? null,
    finishedAt: row.finishedAt?.toISOString() ?? null,
  };
}

export class GenerationService {
  constructor(
    private genRepo: GenerationRepository,
    private taskRepo: TaskRepository,
    private modelConfigRepo: ModelConfigRepository,
    private queues: Map<string, Queue>,
  ) {}

  async createGeneration(
    projectId: string,
    body: CreateGenerationRequest,
    requestedBy: string,
    isMemberOrAdmin: boolean,
  ): Promise<
    | { taskId: string; status: 'pending' }
    | 'forbidden'
    | 'conflict'
    | 'insufficient_quota'
    | 'pricing_not_configured'
    | 'model_not_found'
    | 'model_disabled'
    | 'model_not_executable'
  > {
    if (!isMemberOrAdmin) return 'forbidden';

    const directionId =
      body.mode === 'generate' ? body.directionId : (body.directionId ?? null);
    const paramHash = hashExecutionInput({
      mode: body.mode,
      briefRevisionId: body.briefRevisionId,
      directionId,
      parentVersionId: body.parentVersionId,
      inputAssetIds: body.inputAssetIds ?? [],
      instruction: body.instruction,
      modelConfigId: body.modelConfigId,
      parameters: body.parameters,
      expectedProjectRevision: body.expectedProjectRevision,
      acknowledgeBriefChange:
        body.mode === 'edit' ? body.acknowledgeBriefChange : undefined,
    });
    const idempotencyKey = createHash('sha256')
      .update(`${projectId}:${requestedBy}:${paramHash}`)
      .digest('hex');

    const existing = await this.genRepo.findByIdempotencyKey(idempotencyKey);
    if (existing) {
      const task = await this.taskRepo.findById(existing.taskId);
      if (!task) return 'conflict';
      return { taskId: task.id, status: 'pending' };
    }

    const modelConfig = await this.modelConfigRepo.findById(body.modelConfigId);
    if (!modelConfig) return 'model_not_found';
    if (!modelConfig.isActive) return 'model_disabled';

    if (
      env.AI_PROVIDER_MODE === 'real' &&
      modelConfig.providerId !== 'mock' &&
      modelConfig.costPerImageMinor <= 0
    ) {
      return 'pricing_not_configured';
    }

    const executableModelId =
      env.AI_PROVIDER_MODE === 'real' &&
      env.OPENAI_API_KEY &&
      modelConfig.providerId === 'openai'
        ? env.AI_DEFAULT_IMAGE_MODEL
        : env.AI_PROVIDER_MODE !== 'real' && modelConfig.providerId === 'mock'
          ? 'mock-full'
          : null;
    if (modelConfig.modelId !== executableModelId)
      return 'model_not_executable';
    const outputCount = body.parameters.count ?? 1;
    const estimatedFee = {
      status: 'estimated' as const,
      amountMinor: modelConfig.costPerImageMinor * outputCount,
      currency: modelConfig.currency,
      provider: modelConfig.providerId,
      model: modelConfig.modelId,
    };
    let created: Awaited<ReturnType<GenerationRepository['createWithOutbox']>>;
    try {
      created = await this.genRepo.createWithOutbox({
        projectId,
        mode: body.mode,
        briefRevisionId: body.briefRevisionId,
        directionId,
        parentVersionId: body.parentVersionId,
        inputAssetIds: body.inputAssetIds ?? [],
        instruction: body.instruction,
        modelConfigId: body.modelConfigId,
        parameters: body.parameters as Record<string, unknown>,
        parametersHash: paramHash,
        idempotencyKey,
        requestedBy,
        outputCount,
        modelSnapshot: {
          providerId: modelConfig.providerId,
          modelId: modelConfig.modelId,
          costPerImageMinor: modelConfig.costPerImageMinor,
          currency: modelConfig.currency,
        },
        estimatedFee,
      });
    } catch (err) {
      if (err instanceof InsufficientQuotaError) return 'insufficient_quota';
      if (isUniqueViolation(err)) {
        const concurrent =
          await this.genRepo.findByIdempotencyKey(idempotencyKey);
        if (concurrent) return { taskId: concurrent.taskId, status: 'pending' };
      }
      throw err;
    }
    const { task, outbox } = created;

    await this.relayOutbox(
      outbox.id,
      task.id,
      'exhibition-image-generation',
      outbox.payload as Record<string, unknown>,
    );

    return { taskId: task.id, status: 'pending' };
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
      await this.taskRepo.markOutboxPublished(outboxId);
      await this.taskRepo.markQueuedIfPending(taskId);
    } catch {
      await this.taskRepo.incrementOutboxAttempt(outboxId);
    }
  }

  async listGenerations(
    projectId: string,
    opts: { status?: string; cursor?: string; limit?: number },
    isMemberOrAdmin: boolean,
  ): Promise<
    | {
        data: GenerationTaskSummary[];
        page: { nextCursor: string | null; hasMore: boolean };
      }
    | 'forbidden'
  > {
    if (!isMemberOrAdmin) return 'forbidden';

    const result = await this.genRepo.listByProject({ projectId, ...opts });
    return {
      data: result.data.map(toGenerationSummary),
      page: result.page,
    };
  }
}

function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    err.code === '23505'
  );
}
