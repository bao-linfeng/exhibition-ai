import { Queue } from 'bullmq';
import type { Redis } from 'ioredis';

export const QUEUE_ASSET_VALIDATION = 'exhibition-asset-validation';
export const QUEUE_IMAGE_GENERATION = 'exhibition-image-generation';

export interface QueueConfig {
  connection: Redis;
}

export type AssetValidationJobData = {
  taskId: string;
  projectId: string;
  outboxId: string;
};

export type ImageGenerationJobData = {
  taskId: string;
  projectId: string;
  outboxId: string;
};

export function createAssetValidationQueue(config: QueueConfig) {
  return new Queue<AssetValidationJobData>(QUEUE_ASSET_VALIDATION, {
    connection: config.connection,
    defaultJobOptions: {
      removeOnComplete: { count: 100 },
      removeOnFail: { count: 500 },
    },
  });
}

export function createImageGenerationQueue(config: QueueConfig) {
  return new Queue<ImageGenerationJobData>(QUEUE_IMAGE_GENERATION, {
    connection: config.connection,
    defaultJobOptions: {
      removeOnComplete: { count: 100 },
      removeOnFail: { count: 500 },
    },
  });
}
