import type {
  BriefRepository,
  DirectionRepository,
  ProjectRepository,
  TaskRepository,
} from '@exhibition/backend';
import { logger } from '@exhibition/backend';
import {
  ProviderError,
  type PromptRegistry,
  type TextProviderRegistry,
} from '@exhibition/ai';

export interface DesignDirectionJobData {
  taskId: string;
  projectId: string;
  outboxId: string;
}

interface GeneratedDirection {
  name: string;
  layoutConcept: string;
  materialPalette: string;
  spatialFlow: string;
  constraints: string[];
  humanReviewItems: string[] | null;
}

export async function processDesignDirection(
  data: DesignDirectionJobData,
  deps: {
    taskRepo: TaskRepository;
    briefRepo: BriefRepository;
    directionRepo: DirectionRepository;
    projectRepo: ProjectRepository;
    textProviderRegistry: TextProviderRegistry;
    textProviderId: string;
    promptRegistry: PromptRegistry;
  },
): Promise<void> {
  const { taskId, projectId } = data;
  const {
    taskRepo,
    briefRepo,
    directionRepo,
    projectRepo,
    textProviderRegistry,
    textProviderId,
    promptRegistry,
  } = deps;

  try {
    const task = await taskRepo.findById(taskId);
    if (!task) {
      await failTask(taskRepo, taskId, 'TASK_NOT_FOUND');
      return;
    }
    const snapshot = asRecord(task.inputSnapshot);
    const briefRevisionId = snapshot?.briefRevisionId;
    if (typeof briefRevisionId !== 'string') {
      await failTask(taskRepo, taskId, 'BRIEF_REVISION_MISSING');
      return;
    }
    const briefRevision = await briefRepo.findByProjectId(
      briefRevisionId,
      projectId,
    );
    if (!briefRevision) {
      await failTask(taskRepo, taskId, 'BRIEF_REVISION_NOT_FOUND');
      return;
    }

    await taskRepo.updateStatus(taskId, 'running', { startedAt: new Date() });
    const promptSnapshot = promptRegistry.snapshot('design_direction', {
      brief_summary: JSON.stringify(briefRevision.content),
    });
    let result;
    try {
      const provider = textProviderRegistry.resolve(textProviderId);
      result = await provider.generate({
        requestId: taskId,
        promptSnapshot: { ...promptSnapshot },
        variables: { brief_summary: JSON.stringify(briefRevision.content) },
      });
    } catch (err) {
      if (err instanceof ProviderError) {
        await failTask(taskRepo, taskId, err.code, err.message, err.retryable);
        return;
      }
      throw err;
    }

    const directions = parseDirections(result.text);
    if (!directions) {
      await failTask(taskRepo, taskId, 'DESIGN_DIRECTION_INVALID_JSON');
      return;
    }
    const requestedCount =
      typeof snapshot?.count === 'number' ? snapshot.count : 3;
    const count = Math.min(Math.max(requestedCount, 1), 5);
    const inserted = await directionRepo.bulkInsertDirections(
      directions.slice(0, count).map((direction) => ({
        projectId,
        briefRevisionId,
        sourceTaskId: taskId,
        title: direction.name.slice(0, 200),
        concept: direction.spatialFlow.slice(0, 2000),
        layoutDescription: direction.layoutConcept.slice(0, 2000),
        materialsAndColors: direction.materialPalette.slice(0, 1000),
        constraintsChecklist: direction.constraints
          .slice(0, 20)
          .map((item) => item.slice(0, 500)),
        questionsForConfirmation:
          direction.humanReviewItems
            ?.slice(0, 10)
            .map((item) => item.slice(0, 500)) ?? null,
        promptSnapshot: { ...promptSnapshot },
        textUsage: { ...result.usage },
        createdBy: task.requestedBy,
      })),
    );
    if (inserted.length === 0) {
      await failTask(taskRepo, taskId, 'DESIGN_DIRECTION_EMPTY_RESULT');
      return;
    }
    await taskRepo.updateStatus(taskId, 'succeeded', {
      finishedAt: new Date(),
      canCancel: false,
      canRetry: false,
    });

    // 设计方向生成成功后，自动将项目从 briefing 推进到 designing
    const project = await projectRepo.findById(projectId);
    if (project && project.status === 'briefing') {
      await projectRepo.update(
        projectId,
        { status: 'designing' },
        project.revision,
      );
      logger.info({ projectId }, 'Project advanced from briefing to designing');
    }

    logger.info(
      { taskId, directionCount: inserted.length },
      'Design directions completed',
    );
  } catch (err) {
    logger.error({ taskId, err }, 'Design direction error');
    await failTask(taskRepo, taskId, 'INTERNAL_ERROR');
    throw err;
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function parseDirections(text: string): GeneratedDirection[] | null {
  try {
    const parsed: unknown = JSON.parse(stripCodeFence(text));
    if (!Array.isArray(parsed)) return null;
    const directions = parsed.map(toGeneratedDirection);
    return directions.every(
      (direction): direction is GeneratedDirection => direction !== null,
    )
      ? directions
      : null;
  } catch {
    return null;
  }
}

function toGeneratedDirection(value: unknown): GeneratedDirection | null {
  const row = asRecord(value);
  if (!row) return null;
  const { name, layoutConcept, materialPalette, spatialFlow } = row;
  if (
    typeof name !== 'string' ||
    typeof layoutConcept !== 'string' ||
    typeof materialPalette !== 'string' ||
    typeof spatialFlow !== 'string'
  )
    return null;
  const constraints = toStringArray(row.constraints);
  const humanReviewItems =
    row.humanReviewItems === undefined
      ? null
      : toStringArray(row.humanReviewItems);
  if (!constraints || (row.humanReviewItems !== undefined && !humanReviewItems))
    return null;
  return {
    name,
    layoutConcept,
    materialPalette,
    spatialFlow,
    constraints,
    humanReviewItems,
  };
}

function toStringArray(value: unknown): string[] | null {
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
    ? value
    : null;
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
  errorMessage = `Design direction generation failed: ${errorCode}`,
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
