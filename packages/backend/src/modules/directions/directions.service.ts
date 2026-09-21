import { createHash } from 'node:crypto';
import type { Queue } from 'bullmq';
import type { DesignDirection } from '@exhibition/contracts';
import type { DesignDirectionRow } from '@exhibition/db';
import { QUEUE_DESIGN_DIRECTION } from '../../infrastructure/queue.js';
import type { ProjectPolicy } from '../projects/project.policy.js';
import type { TaskRepository } from '../tasks/tasks.repository.js';
import type { DirectionRepository } from './directions.repository.js';

function toDirection(row: DesignDirectionRow): DesignDirection {
  return {
    id: row.id,
    projectId: row.projectId,
    briefRevisionId: row.briefRevisionId,
    sourceTaskId: row.sourceTaskId,
    title: row.title,
    concept: row.concept,
    layoutDescription: row.layoutDescription,
    materialsAndColors: row.materialsAndColors,
    constraintsChecklist: (row.constraintsChecklist as string[]) ?? [],
    questionsForConfirmation:
      (row.questionsForConfirmation as string[] | null) ?? undefined,
    createdBy: row.createdBy,
    createdAt: row.createdAt.toISOString(),
  };
}

export class DirectionService {
  constructor(
    private repo: DirectionRepository,
    private policy: ProjectPolicy,
    private taskRepo: TaskRepository,
    private queues: Map<string, Queue>,
  ) {}

  async createDirectionsTask(
    projectId: string,
    briefRevisionId: string,
    inputAssetIds: string[],
    count: number,
    actorId: string,
  ): Promise<{ taskId: string; status: 'pending' } | 'forbidden'> {
    if (!(await this.policy.canUseAgent(actorId, projectId)))
      return 'forbidden';
    const idempotencyKey = createHash('sha256')
      .update(`design_direction:${projectId}:${briefRevisionId}:${actorId}`)
      .digest('hex');
    const existing = await this.taskRepo.findByIdempotencyKey(idempotencyKey);
    if (existing) return { taskId: existing.id, status: 'pending' };

    const inputSnapshot = {
      briefRevisionId,
      inputAssetIds,
      count,
      requestedAt: new Date().toISOString(),
    };
    const { task, outbox } = await this.repo.createTaskWithOutbox({
      projectId,
      briefRevisionId,
      inputAssetIds,
      count,
      requestedBy: actorId,
      idempotencyKey,
      inputSnapshot,
    });
    await this.relayOutbox(
      outbox.id,
      task.id,
      outbox.payload as Record<string, unknown>,
    );
    return { taskId: task.id, status: 'pending' };
  }

  async listDirections(
    projectId: string,
    actorId: string,
    opts: { briefRevisionId?: string; cursor?: string; limit?: number },
  ): Promise<
    | {
        data: DesignDirection[];
        page: { nextCursor: string | null; hasMore: boolean };
      }
    | 'forbidden'
  > {
    if (!(await this.policy.isMemberOrAdmin(actorId, projectId))) {
      return 'forbidden';
    }
    const result = await this.repo.listByProject({ projectId, ...opts });
    return { data: result.data.map(toDirection), page: result.page };
  }

  async getDirection(
    projectId: string,
    directionId: string,
    actorId: string,
  ): Promise<DesignDirection | null | 'forbidden'> {
    if (!(await this.policy.isMemberOrAdmin(actorId, projectId))) {
      return 'forbidden';
    }
    const row = await this.repo.findByIdAndProject(directionId, projectId);
    return row ? toDirection(row) : null;
  }

  private async relayOutbox(
    outboxId: string,
    taskId: string,
    payload: Record<string, unknown>,
  ) {
    const queue = this.queues.get(QUEUE_DESIGN_DIRECTION);
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
}
