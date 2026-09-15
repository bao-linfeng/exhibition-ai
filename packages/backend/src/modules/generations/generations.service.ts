import { createHash } from 'node:crypto';
import type { Queue } from 'bullmq';
import type {
  CreateGenerationRequest,
  GenerationTaskSummary,
  TaskOutput,
} from '@exhibition/contracts';
import type { TaskRepository } from '../tasks/tasks.repository.js';
import type { GenerationRepository } from './generations.repository.js';

function hashParameters(params: Record<string, unknown>): string {
  const sorted: Record<string, unknown> = {};
  for (const key of Object.keys(params).sort()) {
    sorted[key] = params[key];
  }
  return createHash('sha256').update(JSON.stringify(sorted)).digest('hex');
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
    private queues: Map<string, Queue>,
  ) {}

  async createGeneration(
    projectId: string,
    body: CreateGenerationRequest,
    requestedBy: string,
    isMemberOrAdmin: boolean,
  ): Promise<{ taskId: string; status: 'pending' } | 'forbidden' | 'conflict'> {
    if (!isMemberOrAdmin) return 'forbidden';

    const directionId =
      body.mode === 'generate' ? body.directionId : (body.directionId ?? null);
    const paramHash = hashParameters({
      mode: body.mode,
      briefRevisionId: body.briefRevisionId,
      directionId,
      parentVersionId: body.parentVersionId,
      instruction: body.instruction,
      modelConfigId: body.modelConfigId,
      parameters: body.parameters,
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

    const outputCount = body.parameters.count ?? 1;
    const inputSnapshot: Record<string, unknown> = {
      mode: body.mode,
      briefRevisionId: body.briefRevisionId,
      directionId,
      parentVersionId: body.parentVersionId,
      inputAssetIds: body.inputAssetIds ?? [],
      instruction: body.instruction,
      modelConfigId: body.modelConfigId,
      parameters: body.parameters,
      parametersHash: paramHash,
      requestedAt: new Date().toISOString(),
    };
    const { task, outbox } = await this.genRepo.createWithOutbox({
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
      inputSnapshot,
    });

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
      await this.taskRepo.updateStatus(taskId, 'queued');
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
