import { createHash } from 'node:crypto';
import type { Queue } from 'bullmq';
import { QUEUE_BRIEF_PARSE } from '../../infrastructure/queue.js';
import type { TaskRepository } from '../tasks/tasks.repository.js';
import type { BriefParseRepository } from './brief-parse.repository.js';

export class BriefParseService {
  constructor(
    private repo: BriefParseRepository,
    private taskRepo: TaskRepository,
    private queues: Map<string, Queue>,
  ) {}

  async createParseTask(
    projectId: string,
    text: string,
    baseBriefRevisionId: string | null,
    requestedBy: string,
    role: string,
  ): Promise<{ taskId: string; status: 'pending' } | 'forbidden'> {
    void role;
    const hash = createHash('sha256')
      .update(
        JSON.stringify({ projectId, text, baseBriefRevisionId, requestedBy }),
      )
      .digest('hex');
    const idempotencyKey = `brief_parse:${hash}`;
    const existing = await this.taskRepo.findByIdempotencyKey(idempotencyKey);
    if (existing) return { taskId: existing.id, status: 'pending' };

    const inputSnapshot = {
      text,
      baseBriefRevisionId,
      requestedAt: new Date().toISOString(),
    };
    const { task, outbox } = await this.repo.createWithOutbox({
      projectId,
      requestedBy,
      idempotencyKey,
      text,
      baseBriefRevisionId,
      inputSnapshot,
    });
    await this.relayOutbox(
      outbox.id,
      task.id,
      outbox.payload as Record<string, unknown>,
    );
    return { taskId: task.id, status: 'pending' };
  }

  private async relayOutbox(
    outboxId: string,
    taskId: string,
    payload: Record<string, unknown>,
  ) {
    const queue = this.queues.get(QUEUE_BRIEF_PARSE);
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
}
