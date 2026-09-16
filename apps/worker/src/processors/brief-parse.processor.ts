import type { TaskRepository } from '@exhibition/backend';
import { logger } from '@exhibition/backend';
import {
  ProviderError,
  type PromptRegistry,
  type TextProviderRegistry,
} from '@exhibition/ai';

export interface BriefParseJobData {
  taskId: string;
  projectId: string;
  outboxId: string;
}

export async function processBriefParse(
  data: BriefParseJobData,
  deps: {
    taskRepo: TaskRepository;
    textProviderRegistry: TextProviderRegistry;
    textProviderId: string;
    promptRegistry: PromptRegistry;
  },
): Promise<void> {
  const { taskId } = data;
  const { taskRepo, textProviderRegistry, textProviderId, promptRegistry } =
    deps;

  try {
    const task = await taskRepo.findById(taskId);
    if (!task) {
      await failTask(taskRepo, taskId, 'TASK_NOT_FOUND');
      return;
    }
    const snapshot = asRecord(task.inputSnapshot);
    const text = snapshot?.text;
    if (typeof text !== 'string' || text.length === 0) {
      await failTask(taskRepo, taskId, 'BRIEF_TEXT_MISSING');
      return;
    }

    await taskRepo.updateStatus(taskId, 'running', { startedAt: new Date() });
    const promptSnapshot = promptRegistry.snapshot('brief_parse', {
      client_description: text,
    });

    let result;
    try {
      const provider = textProviderRegistry.resolve(textProviderId);
      result = await provider.generate({
        requestId: taskId,
        promptSnapshot,
        variables: { client_description: text },
      });
    } catch (err) {
      if (err instanceof ProviderError) {
        await failTask(taskRepo, taskId, err.code, err.message, err.retryable);
        return;
      }
      throw err;
    }

    const parseResult = parseObject(result.text);
    if (!parseResult) {
      await failTask(taskRepo, taskId, 'BRIEF_PARSE_INVALID_JSON');
      return;
    }

    await taskRepo.updateInputSnapshot(taskId, {
      ...snapshot,
      parseResult,
      promptSnapshot,
      textUsage: result.usage,
    });
    await taskRepo.updateStatus(taskId, 'succeeded', {
      finishedAt: new Date(),
      canCancel: false,
      canRetry: false,
    });
    logger.info({ taskId }, 'Brief parse completed');
  } catch (err) {
    logger.error({ taskId, err }, 'Brief parse error');
    await failTask(taskRepo, taskId, 'INTERNAL_ERROR');
    throw err;
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function parseObject(text: string): Record<string, unknown> | null {
  try {
    const parsed: unknown = JSON.parse(stripCodeFence(text));
    return asRecord(parsed);
  } catch {
    return null;
  }
}

function stripCodeFence(text: string): string {
  return text
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '');
}

async function failTask(
  taskRepo: TaskRepository,
  taskId: string,
  errorCode: string,
  errorMessage = `Brief parse failed: ${errorCode}`,
  canRetry = true,
): Promise<void> {
  await taskRepo.updateStatus(taskId, 'failed', {
    finishedAt: new Date(),
    errorCode,
    errorMessage,
    canCancel: false,
    canRetry,
  });
}
