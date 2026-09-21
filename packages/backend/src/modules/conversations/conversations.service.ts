import type { Queue } from 'bullmq';
import type {
  BriefContent,
  CreateGenerationRequest,
} from '@exhibition/contracts';
import type { Confirmation, Conversation, Database } from '@exhibition/db';
import {
  agentRuns,
  confirmations,
  conversations,
  messages,
  tasks,
} from '@exhibition/db';
import { and, desc, eq } from 'drizzle-orm';
import type { BriefRepository } from '../briefs/index.js';
import type { EventsService } from '../events/events.service.js';
import type { GenerationService } from '../generations/index.js';
import type { ProjectPolicy } from '../projects/project.policy.js';
import type { TaskRepository } from '../tasks/index.js';
import {
  AgentRunRepository,
  ConfirmationRepository,
  ConversationRepository,
  MessageRepository,
} from './conversations.repository.js';

export class ConversationService {
  constructor(
    private db: Database,
    private convRepo: ConversationRepository,
    private msgRepo: MessageRepository,
    private runRepo: AgentRunRepository,
    private confirmRepo: ConfirmationRepository,
    private taskRepo: TaskRepository,
    private queues: Map<string, Queue>,
    private eventsService: EventsService,
    private briefRepo: BriefRepository,
    private generationService: GenerationService,
    private policy: ProjectPolicy,
  ) {}

  async getOrCreateConversation(
    projectId: string,
    actorId: string,
  ): Promise<Conversation | 'forbidden'> {
    if (!(await this.policy.isMemberOrAdmin(actorId, projectId))) {
      return 'forbidden';
    }
    return this.convRepo.findOrCreateByProjectId(projectId);
  }

  async listMessages(
    conversationId: string,
    actorId: string,
    opts: { before?: string; limit?: number },
  ) {
    const conversation = await this.convRepo.findById(conversationId);
    if (!conversation) return 'forbidden' as const;
    if (!(await this.policy.isMemberOrAdmin(actorId, conversation.projectId))) {
      return 'forbidden';
    }
    return this.msgRepo.list(conversationId, opts);
  }

  async sendMessage(input: {
    projectId: string;
    conversationId: string;
    text: string;
    clientMessageId: string;
    assetIds?: string[];
    actorId: string;
  }): Promise<
    | { messageId: string; runId: string; taskId: string | null }
    | 'forbidden'
    | 'active_run_exists'
    | 'duplicate'
  > {
    if (!(await this.policy.canUseAgent(input.actorId, input.projectId))) {
      return 'forbidden';
    }

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
      createdBy: input.actorId,
    });

    const { task, outbox } = await this.taskRepo.createWithOutbox({
      projectId: input.projectId,
      kind: 'agent_run',
      requestedBy: input.actorId,
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
      const assistantMessage = await this.msgRepo.findByRunId(run.id);
      if (assistantMessage?.status === 'streaming') {
        await this.msgRepo.updateStatus(assistantMessage.id, 'interrupted');
      }
      await this.runRepo.updateStatus(run.id, 'cancelled', {
        finishedAt: new Date(),
      });
      await this.taskRepo.updateStatus(run.taskId, 'failed', {
        finishedAt: new Date(),
        errorCode: 'CONFIRMATION_REJECTED',
        errorMessage: 'User rejected the confirmation',
        canCancel: false,
        canRetry: false,
      });
      await this.convRepo.setActiveRun(run.conversationId, null);
    }

    return 'ok';
  }

  async findExpiredConfirmationIds(): Promise<string[]> {
    return this.confirmRepo.findExpiredPendingIds();
  }

  async handleConfirmationExpiry(
    confirmationId: string,
  ): Promise<'ok' | 'not_found' | 'not_pending'> {
    return this.expireConfirmationWithReason(
      confirmationId,
      'CONFIRMATION_EXPIRED',
    );
  }

  async expireConfirmationWithReason(
    confirmationId: string,
    reason: string,
  ): Promise<'ok' | 'not_found' | 'not_pending'> {
    return this.db.transaction(async (tx) => {
      const [confirmation] = await tx
        .select({
          id: confirmations.id,
          runId: confirmations.runId,
          status: confirmations.status,
        })
        .from(confirmations)
        .where(eq(confirmations.id, confirmationId))
        .limit(1);
      if (!confirmation) return 'not_found' as const;
      if (confirmation.status !== 'pending') return 'not_pending' as const;

      const now = new Date();
      const expired = await tx
        .update(confirmations)
        .set({ status: 'expired' })
        .where(
          and(
            eq(confirmations.id, confirmation.id),
            eq(confirmations.status, 'pending'),
          ),
        )
        .returning({ id: confirmations.id });
      if (expired.length === 0) return 'not_pending' as const;

      const [run] = await tx
        .select()
        .from(agentRuns)
        .where(eq(agentRuns.id, confirmation.runId))
        .limit(1);
      if (run?.status === 'awaiting_confirmation') {
        const [assistantMessage] = await tx
          .select({ id: messages.id, status: messages.status })
          .from(messages)
          .where(
            and(eq(messages.runId, run.id), eq(messages.role, 'assistant')),
          )
          .orderBy(desc(messages.createdAt))
          .limit(1);
        if (assistantMessage?.status === 'streaming') {
          await tx
            .update(messages)
            .set({ status: 'interrupted' })
            .where(eq(messages.id, assistantMessage.id));
        }
        await tx
          .update(agentRuns)
          .set({ status: 'cancelled', finishedAt: now })
          .where(eq(agentRuns.id, run.id));
        await tx
          .update(tasks)
          .set({
            status: 'failed',
            finishedAt: now,
            errorCode: reason,
            errorMessage:
              reason === 'CONFIRMATION_EXPIRED'
                ? 'Confirmation expired'
                : `Confirmation invalidated: ${reason}`,
            canCancel: false,
            canRetry: false,
          })
          .where(eq(tasks.id, run.taskId));
        await tx
          .update(conversations)
          .set({ activeRunId: null, updatedAt: now })
          .where(eq(conversations.id, run.conversationId));
      }

      return 'ok' as const;
    });
  }

  async expireConfirmationsForUser(
    userId: string,
    projectId: string,
    reason: string,
  ): Promise<void> {
    const pendingConfirmations = await this.db
      .select({ id: confirmations.id })
      .from(confirmations)
      .where(
        and(
          eq(confirmations.requestedBy, userId),
          eq(confirmations.projectId, projectId),
          eq(confirmations.status, 'pending'),
        ),
      );

    for (const confirmation of pendingConfirmations) {
      await this.expireConfirmationWithReason(confirmation.id, reason);
    }
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
        taskId: string | null;
        briefRevisionId: string | null;
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
    if (confirmation.status === 'approved') {
      return {
        confirmationId: id,
        status: 'approved',
        taskId: confirmation.resultTaskId,
        briefRevisionId: confirmation.resultBriefRevisionId,
      };
    }
    if (confirmation.status !== 'pending') return 'not_pending';
    if (confirmation.payloadHash !== payloadHash) return 'hash_mismatch';
    if (confirmation.expiresAt <= new Date()) {
      await this.handleConfirmationExpiry(id);
      return 'expired';
    }

    // 原子占位：CAS pending → processing，防止并发重复执行副作用
    const claimed = await this.confirmRepo.tryClaimPending(id);
    if (!claimed) return 'not_pending';

    if (confirmation.action === 'apply_brief_patch') {
      const projectRevision =
        await this.briefRepo.findProjectRevision(projectId);
      if (projectRevision === null) {
        await this.confirmRepo.updateStatus(id, 'failed');
        throw new Error('Project not found while applying brief patch');
      }

      let revision: Awaited<ReturnType<typeof this.briefRepo.createRevision>>;
      try {
        revision = await this.briefRepo.createRevision({
          projectId,
          content: (confirmation.payload as { patch: BriefContent }).patch,
          createdBy: requestedBy,
          expectedRevision: projectRevision,
        });
      } catch (err) {
        await this.confirmRepo.updateStatus(id, 'failed');
        throw err;
      }
      if (revision === 'conflict') {
        await this.confirmRepo.updateStatus(id, 'failed');
        throw new Error('Project changed while applying brief patch');
      }
      if (revision === 'not_found') {
        await this.confirmRepo.updateStatus(id, 'failed');
        throw new Error('Project not found while applying brief patch');
      }

      await this.confirmRepo.updateStatus(id, 'approved', {
        resultBriefRevisionId: revision.id,
      });
      const run = await this.runRepo.findById(confirmation.runId);
      if (run?.status === 'awaiting_confirmation') {
        const assistantMessage = await this.msgRepo.findByRunId(run.id);
        if (assistantMessage?.status === 'streaming') {
          await this.msgRepo.updateStatus(assistantMessage.id, 'completed');
        }
        await this.runRepo.updateStatus(run.id, 'completed', {
          finishedAt: new Date(),
        });
        await this.taskRepo.updateStatus(run.taskId, 'succeeded', {
          finishedAt: new Date(),
          canCancel: false,
          canRetry: false,
        });
        await this.convRepo.setActiveRun(run.conversationId, null);
      }
      return {
        confirmationId: id,
        status: 'approved',
        taskId: null,
        briefRevisionId: revision.id,
      };
    }

    if (confirmation.action === 'create_generation') {
      const projectRevision =
        await this.briefRepo.findProjectRevision(projectId);
      if (projectRevision === null) {
        await this.confirmRepo.updateStatus(id, 'failed');
        throw new Error('Project not found while creating generation');
      }

      const payload = confirmation.payload as {
        mode?: 'generate' | 'edit';
        briefRevisionId: string;
        directionId?: string;
        instruction: string;
        modelConfigId: string;
        parameters?: Record<string, unknown>;
        parentVersionId?: string;
        inputAssetIds?: string[];
        sizePreset?: string;
        outputCount?: number;
      };
      const generation = {
        mode: payload.mode ?? 'generate',
        briefRevisionId: payload.briefRevisionId,
        directionId: payload.directionId,
        instruction: payload.instruction,
        modelConfigId: payload.modelConfigId,
        parameters: {
          ...payload.parameters,
          count: payload.parameters?.count ?? payload.outputCount,
          sizePreset:
            payload.parameters?.sizePreset ??
            payload.sizePreset ??
            'landscape_4_3',
        },
        parentVersionId: payload.parentVersionId ?? null,
        inputAssetIds: payload.inputAssetIds,
        expectedProjectRevision: projectRevision,
      } as CreateGenerationRequest;

      let result: Awaited<
        ReturnType<typeof this.generationService.createGeneration>
      >;
      try {
        result = await this.generationService.createGeneration(
          projectId,
          generation,
          requestedBy,
        );
      } catch (err) {
        await this.confirmRepo.updateStatus(id, 'failed');
        throw err;
      }
      if (typeof result === 'string') {
        await this.confirmRepo.updateStatus(id, 'failed');
        throw new Error(`Failed to create generation: ${result}`);
      }

      await this.confirmRepo.updateStatus(id, 'approved', {
        resultTaskId: result.taskId,
      });
      const run = await this.runRepo.findById(confirmation.runId);
      if (run?.status === 'awaiting_confirmation') {
        const assistantMessage = await this.msgRepo.findByRunId(run.id);
        if (assistantMessage?.status === 'streaming') {
          await this.msgRepo.updateStatus(assistantMessage.id, 'completed');
        }
        await this.runRepo.updateStatus(run.id, 'completed', {
          finishedAt: new Date(),
        });
        await this.taskRepo.updateStatus(run.taskId, 'succeeded', {
          finishedAt: new Date(),
          canCancel: false,
          canRetry: false,
        });
        await this.convRepo.setActiveRun(run.conversationId, null);
      }
      return {
        confirmationId: id,
        status: 'approved',
        taskId: result.taskId,
        briefRevisionId: null,
      };
    }

    await this.confirmRepo.updateStatus(id, 'failed');
    throw new Error(`Unsupported confirmation action: ${confirmation.action}`);
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
