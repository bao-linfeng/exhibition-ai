import { Queue } from 'bullmq';
import type { Redis } from 'ioredis';

export const QUEUE_ASSET_VALIDATION = 'exhibition-asset-validation';

export interface QueueConfig {
  connection: Redis;
}

export type AssetValidationJobData = {
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
