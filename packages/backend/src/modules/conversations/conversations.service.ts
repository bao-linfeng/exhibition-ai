import type { Queue } from 'bullmq';
import type { Confirmation, Conversation } from '@exhibition/db';
import type { EventsService } from '../events/events.service.js';
import type { TaskRepository } from '../tasks/index.js';
import {
  AgentRunRepository,
  ConfirmationRepository,
  ConversationRepository,
  MessageRepository,
} from './conversations.repository.js';

export class ConversationService {
  constructor(
    private convRepo: ConversationRepository,
    private msgRepo: MessageRepository,
    private runRepo: AgentRunRepository,
    private confirmRepo: ConfirmationRepository,
    private taskRepo: TaskRepository,
    private queues: Map<string, Queue>,
    private eventsService: EventsService,
  ) {}

  async getOrCreateConversation(
    projectId: string,
    isMember: boolean,
  ): Promise<Conversation | 'forbidden'> {
    if (!isMember) return 'forbidden';
    return this.convRepo.findOrCreateByProjectId(projectId);
  }

  async listMessages(
    conversationId: string,
    opts: { before?: string; limit?: number },
    isMember: boolean,
  ) {
    if (!isMember) return 'forbidden' as const;
    return this.msgRepo.list(conversationId, opts);
  }

  async sendMessage(input: {
    projectId: string;
    conversationId: string;
    text: string;
    clientMessageId: string;
    assetIds?: string[];
    requestedBy: string;
    canGenerate: boolean;
  }): Promise<
    | { messageId: string; runId: string; taskId: string | null }
    | 'forbidden'
    | 'active_run_exists'
    | 'duplicate'
  > {
    if (!input.canGenerate) return 'forbidden';

    const existing = await this.msgRepo.findByClientMessageId(
      input.clientMessageId,
    );
    if (existing) {
      const run = existing.runId
        ? await this.runRepo.findById(existing.runId)
        : await this.runRepo.findLatestByConversationId(
            existing.conversationId,
          );
      if (!run) return 'duplicate';

      const assistantMessage = await this.msgRepo.findByRunId(run.id);
      if (!assistantMessage) return 'duplicate';

      return {
        messageId: assistantMessage.id,
        runId: run.id,
        taskId: run.taskId,
      };
    }

    if (await this.runRepo.findActiveByConversationId(input.conversationId)) {
      return 'active_run_exists';
    }

    const userMessage = await this.msgRepo.create({
      conversationId: input.conversationId,
      role: 'user',
      parts: [
        { type: 'text', text: input.text },
        ...(input.assetIds ?? []).map((assetId) => ({
          type: 'asset',
          assetId,
        })),
      ],
      status: 'completed',
      clientMessageId: input.clientMessageId,
      createdBy: input.requestedBy,
    });

    const { task, outbox } = await this.taskRepo.createWithOutbox({
      projectId: input.projectId,
      kind: 'agent_run',
      requestedBy: input.requestedBy,
      queueName: 'exhibition-agent-run',
      payload: {
        conversationId: input.conversationId,
        messageId: userMessage.id,
        projectId: input.projectId,
      },
    });
    const run = await this.runRepo.create({
      conversationId: input.conversationId,
      projectId: input.projectId,
      taskId: task.id,
    });
    await this.taskRepo.updateInputSnapshot(task.id, {
      conversationId: input.conversationId,
      messageId: userMessage.id,
      runId: run.id,
    });
    const assistantMessage = await this.msgRepo.create({
      conversationId: input.conversationId,
      runId: run.id,
      role: 'assistant',
      parts: [],
      status: 'pending',
    });
    await this.convRepo.setActiveRun(input.conversationId, run.id);

    await this.relayOutbox(
      outbox.id,
      outbox.taskId,
      outbox.queueName,
      outbox.payload as Record<string, unknown>,
    );

    return { messageId: assistantMessage.id, runId: run.id, taskId: task.id };
  }

  async getConfirmation(
    id: string,
    projectId: string,
  ): Promise<Confirmation | null | 'forbidden'> {
    const confirmation = await this.confirmRepo.findById(id);
    if (!confirmation) return null;
    if (confirmation.projectId !== projectId) return 'forbidden';
    return confirmation;
  }

  async findConfirmationById(id: string): Promise<Confirmation | null> {
    return this.confirmRepo.findById(id);
  }

  async rejectConfirmation(
    id: string,
    projectId: string,
    requestedBy: string,
    _reason?: string,
  ): Promise<'ok' | 'not_found' | 'forbidden' | 'not_pending'> {
    const confirmation = await this.confirmRepo.findById(id);
    if (!confirmation) return 'not_found';
    if (
      confirmation.projectId !== projectId ||
      confirmation.requestedBy !== requestedBy
    ) {
      return 'forbidden';
    }
    if (confirmation.status !== 'pending') return 'not_pending';

    await this.confirmRepo.updateStatus(id, 'rejected');
    const run = await this.runRepo.findById(confirmation.runId);
    if (run?.status === 'awaiting_confirmation') {
      await this.runRepo.updateStatus(run.id, 'cancelled', {
        finishedAt: new Date(),
      });
      await this.convRepo.setActiveRun(run.conversationId, null);
    }

    return 'ok';
  }

  async approveConfirmation(
    id: string,
    projectId: string,
    requestedBy: string,
    payloadHash: string,
  ): Promise<
    | {
        confirmationId: string;
        status: 'approved';
        taskId: null;
        briefRevisionId: null;
      }
    | 'not_found'
    | 'forbidden'
    | 'not_pending'
    | 'hash_mismatch'
    | 'expired'
  > {
    const confirmation = await this.confirmRepo.findById(id);
    if (!confirmation) return 'not_found';
    if (
      confirmation.projectId !== projectId ||
      confirmation.requestedBy !== requestedBy
    ) {
      return 'forbidden';
    }
    if (confirmation.status !== 'pending') return 'not_pending';
    if (confirmation.payloadHash !== payloadHash) return 'hash_mismatch';
    if (confirmation.expiresAt <= new Date()) {
      await this.confirmRepo.updateStatus(id, 'expired');
      return 'expired';
    }

    await this.confirmRepo.updateStatus(id, 'approved');
    return {
      confirmationId: id,
      status: 'approved',
      taskId: null,
      briefRevisionId: null,
    };
  }

  private async relayOutbox(
    outboxId: string,
    taskId: string,
    queueName: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
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
}
