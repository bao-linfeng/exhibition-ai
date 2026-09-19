import type {
  AgentRunRepository,
  AssetRepository,
  BriefRepository,
  ConfirmationRepository,
  ConversationRepository,
  EventsService,
  ImageVersionRepository,
  MessageRepository,
  TaskRepository,
} from '@exhibition/backend';
import { logger } from '@exhibition/backend';
import {
  BoothAgent,
  createBoothTools,
  type AgentMessage,
  type MessagePart,
  type TextProvider,
} from '@exhibition/ai';

export interface AgentRunJobData {
  taskId: string;
  projectId: string;
  conversationId: string;
  outboxId: string;
}

export async function processAgentRun(
  data: AgentRunJobData,
  deps: {
    taskRepo: TaskRepository;
    convRepo: ConversationRepository;
    msgRepo: MessageRepository;
    runRepo: AgentRunRepository;
    confirmRepo: ConfirmationRepository;
    briefRepo: BriefRepository;
    assetRepo: AssetRepository;
    imageVersionRepo: ImageVersionRepository;
    eventsService: EventsService;
    textProvider: TextProvider;
    textProviderId: string;
  },
): Promise<void> {
  const { taskId, projectId, conversationId } = data;
  const {
    taskRepo,
    convRepo,
    msgRepo,
    runRepo,
    confirmRepo,
    briefRepo,
    assetRepo,
    imageVersionRepo,
    eventsService,
    textProvider,
  } = deps;

  let runId: string | null = null;
  let messageId: string | null = null;
  let assistantParts: MessagePart[] = [];
  let streamedText = '';
  let streamOffset = 0;
  let toolCallCount = 0;

  try {
    const task = await taskRepo.findById(taskId);
    if (!task) {
      logger.warn({ taskId }, 'Agent task not found');
      return;
    }
    const snapshot = asRecord(task.inputSnapshot);
    const snapshotConversationId = stringValue(snapshot?.conversationId);
    const snapshotRunId = stringValue(snapshot?.runId);
    if (snapshotConversationId && snapshotConversationId !== conversationId) {
      await failTask(taskRepo, taskId, 'CONVERSATION_MISMATCH');
      return;
    }

    const run = snapshotRunId
      ? await runRepo.findById(snapshotRunId)
      : await runRepo.findLatestByConversationId(conversationId);
    if (!run || run.taskId !== taskId || run.projectId !== projectId) {
      await failTask(taskRepo, taskId, 'AGENT_RUN_NOT_FOUND');
      return;
    }
    runId = run.id;

    const assistantMessage = await msgRepo.findByRunId(run.id);
    if (!assistantMessage) {
      await failTask(taskRepo, taskId, 'ASSISTANT_MESSAGE_NOT_FOUND');
      await runRepo.updateStatus(run.id, 'interrupted', {
        finishedAt: new Date(),
        errorCode: 'ASSISTANT_MESSAGE_NOT_FOUND',
      });
      await convRepo.setActiveRun(conversationId, null);
      return;
    }
    messageId = assistantMessage.id;
    assistantParts = toMessageParts(assistantMessage.parts);
    streamOffset = assistantMessage.streamOffset;

    await taskRepo.updateStatus(taskId, 'running', { startedAt: new Date() });
    await runRepo.updateStatus(run.id, 'running', { startedAt: new Date() });
    await msgRepo.updateStatus(assistantMessage.id, 'streaming');

    const recentMessages = await msgRepo.list(conversationId, { limit: 20 });
    const history = toAgentHistory(
      recentMessages.data
        .filter((message) => message.id !== assistantMessage.id)
        .reverse(),
    );
    const userMessage = [...history]
      .reverse()
      .find((message) => message.role === 'user');
    if (!userMessage) {
      await settleInterrupted('USER_MESSAGE_NOT_FOUND');
      return;
    }

    const persistParts = async () => {
      await msgRepo.updateParts(assistantMessage.id, assistantParts);
    };
    const actor = { userId: task.requestedBy, role: 'system' };
    const context = {
      projectId,
      conversationId,
      runId: run.id,
      requestedBy: task.requestedBy,
      getBrief: async () => briefRepo.findCurrentByProjectId(projectId),
      listAssets: async () => {
        const result = await assetRepo.list({
          projectId,
          status: 'ready',
          limit: 20,
        });
        return result.data;
      },
      listVersions: async () => {
        const result = await imageVersionRepo.listByProject({
          projectId,
          limit: 10,
        });
        return result.data;
      },
      createConfirmation: async (input: {
        action: 'apply_brief_patch' | 'create_generation';
        payload: Record<string, unknown>;
        payloadHash: string;
        estimatedFeeMinor?: number;
        currency?: string;
      }) => {
        const confirmation = await confirmRepo.create({
          runId: run.id,
          projectId,
          requestedBy: task.requestedBy,
          action: input.action,
          payload: input.payload,
          payloadHash: input.payloadHash,
          estimatedFeeMinor: input.estimatedFeeMinor,
          currency: input.currency,
          expiresAt: new Date(Date.now() + 15 * 60_000),
        });
        return { confirmationId: confirmation.id };
      },
      onTextDelta: async (delta: string, offset: number) => {
        streamedText += delta;
        streamOffset = Math.max(streamOffset, offset + delta.length);
        const textPart = assistantParts.find(
          (part): part is Extract<MessagePart, { type: 'text' }> =>
            part.type === 'text',
        );
        if (textPart) textPart.text += delta;
        else assistantParts.push({ type: 'text', text: delta });
        await persistParts();
        await msgRepo.updateStreamOffset(assistantMessage.id, streamOffset);
        await eventsService.appendEvent(
          projectId,
          {
            type: 'message.delta',
            data: {
              conversationId,
              messageId: assistantMessage.id,
              delta,
              offset,
            },
          },
          actor,
        );
      },
      onToolCallStart: async (callId: string, toolName: string) => {
        toolCallCount++;
        assistantParts.push({
          type: 'tool',
          toolName,
          callId,
          status: 'running',
          summary: '正在调用工具',
        });
        await persistParts();
        await runRepo.updateStatus(run.id, 'running', { toolCallCount });
        await eventsService.appendEvent(
          projectId,
          {
            type: 'message.delta',
            data: {
              conversationId,
              messageId: assistantMessage.id,
              delta: '',
              offset: streamOffset,
            },
          },
          actor,
        );
      },
      onToolCallEnd: async (
        callId: string,
        toolName: string,
        status: 'succeeded' | 'failed',
        summary: string,
      ) => {
        const part = assistantParts.find(
          (candidate): candidate is Extract<MessagePart, { type: 'tool' }> =>
            candidate.type === 'tool' && candidate.callId === callId,
        );
        if (part) {
          part.toolName = toolName;
          part.status = status;
          part.summary = summary;
          await persistParts();
        }
      },
      onConfirmationCreated: async (
        confirmationId: string,
        question: string,
      ) => {
        assistantParts.push({ type: 'confirmation', confirmationId });
        await persistParts();
        await runRepo.updateStatus(run.id, 'awaiting_confirmation', {
          toolCallCount,
        });
        await eventsService.appendEvent(
          projectId,
          { type: 'confirmation.created', data: { confirmationId, question } },
          actor,
        );
      },
    };

    const agent = new BoothAgent(textProvider, createBoothTools());
    const result = await withTimeout(
      agent.run(userMessage.textContent, history.slice(0, -1), context, {
        maxToolCalls: 8,
        maxDurationMs: 120_000,
        maxRepairAttempts: 1,
      }),
      120_000,
    );
    await persistParts();

    if (result.status === 'completed') {
      await msgRepo.updateStatus(assistantMessage.id, 'completed');
      await runRepo.updateStatus(run.id, 'completed', {
        finishedAt: new Date(),
        toolCallCount,
      });
      await taskRepo.updateStatus(taskId, 'succeeded', {
        finishedAt: new Date(),
        canCancel: false,
        canRetry: false,
      });
      await convRepo.setActiveRun(conversationId, null);
    } else if (result.status === 'awaiting_confirmation') {
      await msgRepo.updateStatus(assistantMessage.id, 'streaming');
      await runRepo.updateStatus(run.id, 'awaiting_confirmation', {
        toolCallCount,
      });
      await taskRepo.updateStatus(taskId, 'awaiting_confirmation', {
        canCancel: false,
        canRetry: false,
      });
    } else {
      await settleInterrupted(result.errorCode ?? 'AGENT_INTERRUPTED');
    }
    await eventsService.appendEvent(
      projectId,
      {
        type: 'message.completed',
        data: {
          conversationId,
          messageId: assistantMessage.id,
          content: streamedText,
        },
      },
      actor,
    );
  } catch (error) {
    logger.error({ taskId, error }, 'Agent run error');
    if (runId && messageId) {
      assistantParts.push({
        type: 'execution_summary',
        summary: '运行已中断',
      });
      await msgRepo.updateParts(messageId, assistantParts);
      await msgRepo.updateStatus(messageId, 'interrupted');
      await runRepo.updateStatus(runId, 'interrupted', {
        finishedAt: new Date(),
        errorCode: 'INTERNAL_ERROR',
        toolCallCount,
      });
      await convRepo.setActiveRun(conversationId, null);
    }
    await failTask(taskRepo, taskId, 'INTERNAL_ERROR');
    throw error;
  }

  async function settleInterrupted(errorCode: string): Promise<void> {
    if (!runId || !messageId) return;
    assistantParts.push({
      type: 'execution_summary',
      summary: '运行已中断',
    });
    await msgRepo.updateParts(messageId, assistantParts);
    await msgRepo.updateStatus(messageId, 'interrupted');
    await runRepo.updateStatus(runId, 'interrupted', {
      finishedAt: new Date(),
      errorCode,
      toolCallCount,
    });
    await failTask(taskRepo, taskId, errorCode);
    await convRepo.setActiveRun(conversationId, null);
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function stringValue(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function toAgentHistory(
  messages: Array<{ role: string; parts: unknown }>,
): AgentMessage[] {
  return messages.flatMap((message) => {
    if (message.role !== 'user' && message.role !== 'assistant') return [];
    const textContent = toMessageParts(message.parts)
      .filter(
        (part): part is Extract<MessagePart, { type: 'text' }> =>
          part.type === 'text',
      )
      .map((part) => part.text)
      .join('');
    return [{ role: message.role, textContent }];
  });
}

function toMessageParts(value: unknown): MessagePart[] {
  return Array.isArray(value) ? (value as MessagePart[]) : [];
}

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error('AGENT_TIMEOUT')), timeoutMs);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

async function failTask(
  taskRepo: TaskRepository,
  taskId: string,
  errorCode: string,
): Promise<void> {
  await taskRepo.updateStatus(taskId, 'failed', {
    finishedAt: new Date(),
    errorCode,
    errorMessage: `Agent run failed: ${errorCode}`,
    canCancel: false,
    canRetry: false,
  });
}
