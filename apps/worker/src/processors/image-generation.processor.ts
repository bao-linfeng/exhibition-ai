import { createHash } from 'node:crypto';
import { Readable } from 'node:stream';
import type {
  AssetRepository,
  GenerationRepository,
  ImageVersionRepository,
  ModelConfigRepository,
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
    storage: StorageProvider;
    bucket: string;
    imageProviderRegistry: ImageProviderRegistry;
    promptRegistry: PromptRegistry;
    modelConfigRepo: ModelConfigRepository;
  },
): Promise<void> {
  const { taskId } = data;
  const {
    taskRepo,
    generationRepo,
    assetRepo,
    imageVersionRepo,
    storage,
    bucket,
    imageProviderRegistry,
    promptRegistry,
    modelConfigRepo,
  } = deps;

  try {
    const taskRow = await taskRepo.findById(taskId);
    if (!taskRow) {
      logger.warn({ taskId }, 'Task not found, skipping');
      return;
    }
    if (taskRow.status === 'cancelled') {
      logger.info({ taskId }, 'Task already cancelled, skipping execution');
      return;
    }

    // For retry tasks, fall back to the original task's generation request
    const lookupTaskId = taskRow.retryOfTaskId ?? taskId;
    const genRequest = await generationRepo.findByTaskId(lookupTaskId);

    if (!genRequest) {
      await failTask(taskRepo, taskId, 'GENERATION_REQUEST_NOT_FOUND');
      return;
    }

    await taskRepo.updateStatus(taskId, 'running', { startedAt: new Date() });

    const promptSnapshot = promptRegistry.snapshot('image_generation_prompt', {
      instruction: genRequest.instruction,
      mode: genRequest.mode,
      briefRevisionId: genRequest.briefRevisionId,
    });

    // Look up the model config from DB to get the providerId, then resolve the
    // in-process registry. The registry is keyed by providerId, not by the DB UUID.
    const dbModelConfig = await modelConfigRepo.findById(
      genRequest.modelConfigId,
    );
    if (!dbModelConfig) {
      await failTask(
        taskRepo,
        taskId,
        'model_not_found',
        `Model config not found: ${genRequest.modelConfigId}`,
        false,
      );
      return;
    }
    if (!dbModelConfig.isActive) {
      await failTask(
        taskRepo,
        taskId,
        'model_disabled',
        `Model config is disabled: ${genRequest.modelConfigId}`,
        false,
      );
      return;
    }

    let provider: ReturnType<ImageProviderRegistry['resolve']>['provider'];
    let modelConfig: ReturnType<ImageProviderRegistry['resolve']>['config'];
    try {
      ({ provider, config: modelConfig } = imageProviderRegistry.resolve(
        dbModelConfig.providerId,
      ));
    } catch (err) {
      if (err instanceof ProviderError) {
        await failTask(taskRepo, taskId, err.code, err.message, err.retryable);
        return;
      }
      throw err;
    }

    const parameters = genRequest.parameters as Record<string, unknown>;
    const outputCount = Math.min(Math.max(Number(parameters.count ?? 1), 1), 4);
    const sizePreset = String(parameters.sizePreset ?? 'landscape_4_3');
    const seed =
      parameters.seed !== undefined ? Number(parameters.seed) : undefined;
    const negativePrompt =
      parameters.negativePrompt !== undefined
        ? String(parameters.negativePrompt)
        : undefined;

    let parentImageBytes: Buffer | undefined;
    if (genRequest.mode === 'edit' && genRequest.parentVersionId) {
      try {
        parentImageBytes = await getParentImageBytes(
          imageVersionRepo,
          storage,
          genRequest.parentVersionId,
        );
      } catch (err) {
        logger.warn({ taskId, err }, 'Parent image could not be loaded');
        await failTask(taskRepo, taskId, 'PARENT_IMAGE_NOT_FOUND');
        return;
      }
    }

    let result: ImageGenerationResult;
    try {
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
      });
    } catch (err) {
      if (err instanceof ProviderError) {
        await failTask(taskRepo, taskId, err.code, err.message, err.retryable);
        return;
      }
      throw err;
    }

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
      canRetry: failedCount > 0,
    });

    logger.info(
      { taskId, succeededCount, failedCount },
      'Image generation completed',
    );
  } catch (err) {
    logger.error({ taskId, err }, 'Image generation error');
    await failTask(taskRepo, taskId, 'INTERNAL_ERROR');
    throw err;
  }
}

async function getParentImageBytes(
  imageVersionRepo: ImageVersionRepository,
  storage: StorageProvider,
  parentVersionId: string,
): Promise<Buffer> {
  const parent = await imageVersionRepo.findAssetLocation(parentVersionId);
  if (!parent) throw new Error('Parent image version not found');

  const { body } = await storage.getObject({
    bucket: parent.bucket,
    key: parent.objectKey,
  });
  const stream = body instanceof Readable ? body : Readable.from(body);
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
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
