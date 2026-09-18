import { createHash } from 'node:crypto';
import { Readable } from 'node:stream';
import type {
  AssetRepository,
  BriefRepository,
  DirectionRepository,
  GenerationRepository,
  ImageVersionRepository,
  QuotaService,
  StorageProvider,
  TaskRepository,
} from '@exhibition/backend';
import { logger } from '@exhibition/backend';
import {
  ProviderError,
  type ImageGenerationResult,
  type ImageProviderRegistry,
  type PromptRegistry,
} from '@exhibition/ai';

const PRESET_DIMENSIONS: Record<string, { width: number; height: number }> = {
  landscape_4_3: { width: 1024, height: 768 },
  landscape_16_9: { width: 1280, height: 720 },
  square_1_1: { width: 1024, height: 1024 },
  portrait_3_4: { width: 768, height: 1024 },
  portrait_9_16: { width: 720, height: 1280 },
};

export interface ImageGenerationJobData {
  taskId: string;
  projectId: string;
  outboxId: string;
}

export async function processImageGeneration(
  data: ImageGenerationJobData,
  deps: {
    taskRepo: TaskRepository;
    generationRepo: GenerationRepository;
    assetRepo: AssetRepository;
    imageVersionRepo: ImageVersionRepository;
    briefRepo: BriefRepository;
    directionRepo: DirectionRepository;
    quotaService: QuotaService;
    storage: StorageProvider;
    bucket: string;
    imageProviderRegistry: ImageProviderRegistry;
    promptRegistry: PromptRegistry;
  },
): Promise<void> {
  const { taskId } = data;
  const {
    taskRepo,
    generationRepo,
    assetRepo,
    imageVersionRepo,
    briefRepo,
    directionRepo,
    quotaService,
    storage,
    bucket,
    imageProviderRegistry,
    promptRegistry,
  } = deps;

  let providerAttempted = false;
  let settled = false;
  try {
    const taskRow = await taskRepo.claimForExecution(taskId);
    if (!taskRow) {
      logger.info({ taskId }, 'Task was not claimable, skipping execution');
      return;
    }

    // For retry tasks, fall back to the original task's generation request
    const lookupTaskId = taskRow.retryOfTaskId ?? taskId;
    const genRequest = await generationRepo.findByTaskId(lookupTaskId);

    if (!genRequest) {
      await failBeforeProvider(
        taskRepo,
        quotaService,
        taskId,
        'GENERATION_REQUEST_NOT_FOUND',
      );
      return;
    }

    const briefRevision = await briefRepo.findById(genRequest.briefRevisionId);
    if (!briefRevision) {
      await failBeforeProvider(
        taskRepo,
        quotaService,
        taskId,
        'BRIEF_NOT_FOUND',
      );
      return;
    }

    let directionText = '';
    if (genRequest.directionId) {
      const direction = await directionRepo.findByIdAndProject(
        genRequest.directionId,
        genRequest.projectId,
      );
      if (direction) {
        directionText = [
          direction.title,
          direction.concept,
          direction.layoutDescription,
          direction.materialsAndColors,
        ]
          .filter(Boolean)
          .join('。');
      }
    }

    const briefContent = briefRevision.content as {
      booth?: {
        widthM?: number;
        depthM?: number;
        heightLimitM?: number;
        openSides?: string[];
      };
      brand?: {
        name?: string;
        primaryColor?: string;
        secondaryColor?: string;
        visualKeywords?: string[];
      };
      functionalAreas?: Array<{
        type?: string;
        required?: boolean;
        quantity?: number;
      }>;
      style?: {
        keywords?: string[];
        materials?: string[];
        forbiddenElements?: string[];
      };
      specialRequirements?: string;
    };
    const briefLines: string[] = [];
    if (briefContent.booth) {
      const { widthM, depthM, heightLimitM, openSides } = briefContent.booth;
      const parts = [
        widthM !== undefined && depthM !== undefined
          ? `${widthM}m×${depthM}m`
          : undefined,
        heightLimitM !== undefined ? `限高${heightLimitM}m` : undefined,
        openSides?.length ? `开放面：${openSides.join('、')}` : undefined,
      ].filter(Boolean);
      if (parts.length) briefLines.push(`展台尺寸：${parts.join('，')}`);
    }
    if (briefContent.brand) {
      const { name, primaryColor, secondaryColor, visualKeywords } =
        briefContent.brand;
      const parts = [
        name,
        primaryColor,
        secondaryColor,
        visualKeywords?.join('、'),
      ].filter(Boolean);
      if (parts.length) briefLines.push(`品牌：${parts.join('，')}`);
    }
    if (briefContent.functionalAreas?.length) {
      const areas = briefContent.functionalAreas
        .map((area) =>
          [
            area.quantity && area.quantity > 1
              ? `${area.type}×${area.quantity}`
              : area.type,
            area.required ? '(必须)' : '',
          ]
            .filter(Boolean)
            .join(''),
        )
        .join('、');
      briefLines.push(`功能区：${areas}`);
    }
    if (briefContent.style) {
      const { keywords, materials, forbiddenElements } = briefContent.style;
      const parts = [
        keywords?.join('、'),
        materials?.length ? `材料：${materials.join('、')}` : undefined,
        forbiddenElements?.length
          ? `禁用：${forbiddenElements.join('、')}`
          : undefined,
      ].filter(Boolean);
      if (parts.length) briefLines.push(`风格：${parts.join('，')}`);
    }
    if (briefContent.specialRequirements) {
      briefLines.push(`特殊要求：${briefContent.specialRequirements}`);
    }
    const briefContext = briefLines.length ? `${briefLines.join('\n')}\n` : '';

    const parameters = genRequest.parameters as Record<string, unknown>;
    const sizePreset = String(parameters.sizePreset ?? 'landscape_4_3');
    const negativePrompt =
      parameters.negativePrompt !== undefined
        ? String(parameters.negativePrompt)
        : undefined;
    const promptSnapshot = promptRegistry.snapshot('image_generation_prompt', {
      instruction: genRequest.instruction,
      direction: directionText,
      size_preset: sizePreset,
      brief_context: briefContext,
      negative_prompt_suffix: negativePrompt
        ? `，负向提示词：${negativePrompt}`
        : '',
    });

    const modelSnapshot = (
      taskRow.inputSnapshot as {
        model?: { providerId?: string; modelId?: string };
      } | null
    )?.model;
    if (!modelSnapshot?.providerId || !modelSnapshot.modelId) {
      await failBeforeProvider(
        taskRepo,
        quotaService,
        taskId,
        'model_snapshot_missing',
        'Task model snapshot is missing',
        false,
      );
      return;
    }

    let provider: ReturnType<ImageProviderRegistry['resolve']>['provider'];
    let modelConfig: ReturnType<ImageProviderRegistry['resolve']>['config'];
    try {
      ({ provider, config: modelConfig } = imageProviderRegistry.resolve(
        modelSnapshot.providerId,
        modelSnapshot.modelId,
      ));
    } catch (err) {
      if (err instanceof ProviderError) {
        await failBeforeProvider(
          taskRepo,
          quotaService,
          taskId,
          err.code,
          err.message,
          false,
        );
        return;
      }
      throw err;
    }
    if (modelConfig.modelId !== modelSnapshot.modelId) {
      await failBeforeProvider(
        taskRepo,
        quotaService,
        taskId,
        'model_not_executable',
        `Task model is not executable: ${modelSnapshot.providerId}/${modelSnapshot.modelId}`,
        false,
      );
      return;
    }

    const outputCount = (taskRow.outputs as Array<unknown> | null)?.length ?? 0;
    if (outputCount === 0) {
      await failBeforeProvider(
        taskRepo,
        quotaService,
        taskId,
        'TASK_OUTPUTS_MISSING',
        'Task has no claimed outputs to generate',
        false,
      );
      return;
    }
    const seed =
      parameters.seed !== undefined ? Number(parameters.seed) : undefined;

    let parentImageBytes: Buffer | undefined;
    let parentImageMimeType: string | undefined;
    if (genRequest.mode === 'edit' && genRequest.parentVersionId) {
      try {
        const parentImage = await getParentImage(
          imageVersionRepo,
          storage,
          genRequest.parentVersionId,
          genRequest.projectId,
        );
        parentImageBytes = parentImage.bytes;
        parentImageMimeType = parentImage.mimeType;
      } catch (err) {
        logger.warn({ taskId, err }, 'Parent image could not be loaded');
        await failBeforeProvider(
          taskRepo,
          quotaService,
          taskId,
          'PARENT_IMAGE_NOT_FOUND',
        );
        return;
      }
    }

    const referenceAssets: Array<{ bytes: Buffer; mimeType: string }> = [];
    const inputAssetIds = Array.isArray(genRequest.inputAssetIds)
      ? genRequest.inputAssetIds.filter(
          (assetId): assetId is string => typeof assetId === 'string',
        )
      : [];
    for (const assetId of inputAssetIds) {
      const asset = await assetRepo.findById(assetId);
      if (!asset || asset.status !== 'ready') {
        logger.warn(
          { taskId, assetId },
          'Reference asset not found or not ready, skipping',
        );
        continue;
      }
      try {
        const { body, contentType } = await storage.getObject({
          bucket: asset.bucket,
          key: asset.objectKey,
        });
        if (!contentType) {
          logger.warn(
            { taskId, assetId },
            'Reference asset has no content type, skipping',
          );
          continue;
        }
        const stream = body instanceof Readable ? body : Readable.from(body);
        const chunks: Buffer[] = [];
        for await (const chunk of stream) {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        }
        referenceAssets.push({
          bytes: Buffer.concat(chunks),
          mimeType: contentType,
        });
      } catch (err) {
        logger.warn(
          { taskId, assetId, err },
          'Failed to load reference asset, skipping',
        );
      }
    }

    let result: ImageGenerationResult;
    try {
      providerAttempted = true;
      result = await provider.generate({
        requestId: taskId,
        modelConfig,
        promptSnapshot,
        resolvedPrompt: promptSnapshot.renderedText,
        sizePreset,
        outputCount,
        seed,
        negativePrompt,
        parentImageBytes,
        parentImageMimeType,
        referenceAssets:
          referenceAssets.length > 0 ? referenceAssets : undefined,
      });
    } catch (err) {
      if (err instanceof ProviderError) {
        if (err.acceptance === 'accepted_unknown') {
          await quotaService.markUnknown({ taskId });
          await taskRepo.markTaskReconciling(taskId);
          return;
        }
        await failBeforeProvider(
          taskRepo,
          quotaService,
          taskId,
          err.code,
          err.message,
          false,
        );
        return;
      }
      await quotaService.markUnknown({ taskId });
      await taskRepo.markTaskReconciling(taskId);
      return;
    }

    const settleResult = await quotaService.settleTask({
      taskId,
      actualAmountMinor: getActualAmount(taskRow, outputCount),
      providerUsage: result.usageHint,
    });
    if (!settleResult.ok) {
      await taskRepo.markTaskReconciling(taskId);
      logger.error(
        { taskId, reason: settleResult.reason },
        'Image generation settlement failed',
      );
      throw new Error(`Settlement failed: ${settleResult.reason}`);
    }
    settled = true;

    const dimensions =
      PRESET_DIMENSIONS[sizePreset] ?? PRESET_DIMENSIONS.landscape_4_3!;
    const finalOutputs: Array<{
      ordinal: number;
      state: 'pending' | 'succeeded' | 'failed';
      assetId: string | null;
      versionId: string | null;
      errorCode: string | null;
      errorMessage: string | null;
    }> = [];
    const publishInputs: Array<{
      projectId: string;
      taskId: string;
      outputOrdinal: number;
      assetId: string;
      parentVersionId: string | null;
      briefRevisionId: string;
      width: number;
      height: number;
      sizeBytes: number;
      mimeType: string;
      createdBy: string;
    }> = [];
    const successfulAssets = new Map<number, string>();
    const outputsByOrdinal = new Map(
      result.outputs.map((output) => [output.ordinal, output]),
    );

    for (let ordinal = 0; ordinal < outputCount; ordinal++) {
      const output = outputsByOrdinal.get(ordinal);
      if (!output) {
        finalOutputs.push(failedOutput(ordinal, 'PROVIDER_OUTPUT_MISSING'));
        continue;
      }
      if (output.state === 'failed') {
        finalOutputs.push(
          failedOutput(
            ordinal,
            output.errorCode ?? 'PROVIDER_OUTPUT_FAILED',
            output.errorMessage,
          ),
        );
        continue;
      }
      if (!output.imageBytes) {
        finalOutputs.push(failedOutput(ordinal, 'IMAGE_BYTES_MISSING'));
        continue;
      }

      const mimeType = output.mimeType ?? 'image/png';
      const ext = mimeToExtension(mimeType);
      if (!ext) {
        finalOutputs.push(failedOutput(ordinal, 'UNSUPPORTED_IMAGE_MIME'));
        continue;
      }

      try {
        const sha256 = createHash('sha256')
          .update(output.imageBytes)
          .digest('hex');
        const objectKey = `projects/${genRequest.projectId}/generated/${sha256}.${ext}`;
        await storage.putObject({
          bucket,
          key: objectKey,
          body: output.imageBytes,
          contentType: mimeType,
          contentLength: output.imageBytes.length,
        });
        const asset = await assetRepo.createAsset({
          projectId: genRequest.projectId,
          kind: 'generated_image',
          bucket,
          objectKey,
          originalFilename: `generated_${sha256}.${ext}`,
          mimeType,
          sizeBytes: output.imageBytes.length,
          createdBy: genRequest.requestedBy,
        });
        successfulAssets.set(ordinal, asset.id);
        publishInputs.push({
          projectId: genRequest.projectId,
          taskId,
          outputOrdinal: ordinal,
          assetId: asset.id,
          parentVersionId: genRequest.parentVersionId,
          briefRevisionId: genRequest.briefRevisionId,
          width: dimensions.width,
          height: dimensions.height,
          sizeBytes: output.imageBytes.length,
          mimeType,
          createdBy: genRequest.requestedBy,
        });
      } catch (err) {
        logger.error(
          { taskId, ordinal, err },
          'Failed to persist generated image',
        );
        finalOutputs.push(failedOutput(ordinal, 'IMAGE_PERSIST_FAILED'));
      }
    }

    // publishVersions uses INSERT ... ON CONFLICT (asset_id) DO NOTHING and
    // returns only inserted rows, so a repeated result has no version side effect.
    const publishedVersions =
      publishInputs.length > 0
        ? await imageVersionRepo.publishVersions(publishInputs)
        : [];
    const versionsByOrdinal = new Map(
      publishedVersions.map((version) => [version.outputOrdinal, version]),
    );

    for (const input of publishInputs) {
      const version = versionsByOrdinal.get(input.outputOrdinal);
      if (!version) {
        finalOutputs.push(
          failedOutput(input.outputOrdinal, 'IMAGE_VERSION_NOT_PUBLISHED'),
        );
        continue;
      }
      finalOutputs.push({
        ordinal: input.outputOrdinal,
        state: 'succeeded',
        assetId: successfulAssets.get(input.outputOrdinal) ?? null,
        versionId: version.id,
        errorCode: null,
        errorMessage: null,
      });
    }

    finalOutputs.sort((a, b) => a.ordinal - b.ordinal);
    await imageVersionRepo.updateTaskOutputs(taskId, finalOutputs);

    const succeededCount = finalOutputs.filter(
      (output) => output.state === 'succeeded',
    ).length;
    const failedCount = finalOutputs.length - succeededCount;
    const status =
      failedCount === 0
        ? 'succeeded'
        : succeededCount > 0
          ? 'partially_succeeded'
          : 'failed';
    await taskRepo.updateStatus(taskId, status, {
      finishedAt: new Date(),
      canCancel: false,
      canRetry: false,
    });

    logger.info(
      { taskId, succeededCount, failedCount },
      'Image generation completed',
    );
  } catch (err) {
    logger.error({ taskId, err }, 'Image generation error');
    if (!providerAttempted) {
      await failBeforeProvider(
        taskRepo,
        quotaService,
        taskId,
        'INTERNAL_ERROR',
      );
      return;
    }
    if (settled) {
      await failTask(taskRepo, taskId, 'INTERNAL_ERROR', undefined, false);
      return;
    }
    throw err;
  }
}

async function getParentImage(
  imageVersionRepo: ImageVersionRepository,
  storage: StorageProvider,
  parentVersionId: string,
  projectId: string,
): Promise<{ bytes: Buffer; mimeType: string }> {
  const parent = await imageVersionRepo.findAssetLocation(
    parentVersionId,
    projectId,
  );
  if (!parent) throw new Error('Parent image version not found');

  const { body, contentType } = await storage.getObject({
    bucket: parent.bucket,
    key: parent.objectKey,
  });
  if (!contentType) throw new Error('Parent image content type is missing');
  const stream = body instanceof Readable ? body : Readable.from(body);
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return { bytes: Buffer.concat(chunks), mimeType: contentType };
}

async function failTask(
  taskRepo: TaskRepository,
  taskId: string,
  errorCode: string,
  errorMessage = `Image generation failed: ${errorCode}`,
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

async function failBeforeProvider(
  taskRepo: TaskRepository,
  quotaService: QuotaService,
  taskId: string,
  errorCode: string,
  errorMessage?: string,
  canRetry = false,
): Promise<void> {
  await quotaService.releaseReservation({ taskId });
  await failTask(taskRepo, taskId, errorCode, errorMessage, canRetry);
}

function getActualAmount(
  task: { inputSnapshot: unknown },
  outputCount: number,
): number {
  const costPerImageMinor = (
    task.inputSnapshot as {
      model?: { costPerImageMinor?: unknown };
    } | null
  )?.model?.costPerImageMinor;
  if (
    !Number.isSafeInteger(costPerImageMinor) ||
    (costPerImageMinor as number) < 0 ||
    !Number.isSafeInteger(outputCount)
  ) {
    throw new Error('Task pricing snapshot is invalid');
  }
  const actualAmountMinor = (costPerImageMinor as number) * outputCount;
  if (!Number.isSafeInteger(actualAmountMinor)) {
    throw new Error('Task actual amount exceeds integer limits');
  }
  return actualAmountMinor;
}

function failedOutput(
  ordinal: number,
  errorCode: string,
  errorMessage: string | undefined = undefined,
): {
  ordinal: number;
  state: 'failed';
  assetId: null;
  versionId: null;
  errorCode: string;
  errorMessage: string;
} {
  return {
    ordinal,
    state: 'failed',
    assetId: null,
    versionId: null,
    errorCode,
    errorMessage: errorMessage ?? `Image generation failed: ${errorCode}`,
  };
}

function mimeToExtension(mimeType: string): string | null {
  switch (mimeType) {
    case 'image/png':
      return 'png';
    case 'image/jpeg':
      return 'jpg';
    case 'image/webp':
      return 'webp';
    default:
      return null;
  }
}
