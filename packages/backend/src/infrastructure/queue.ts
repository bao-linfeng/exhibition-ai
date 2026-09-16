import { Queue } from 'bullmq';
import type { Redis } from 'ioredis';

export const QUEUE_ASSET_VALIDATION = 'exhibition-asset-validation';
export const QUEUE_IMAGE_GENERATION = 'exhibition-image-generation';
export const QUEUE_BRIEF_PARSE = 'exhibition-brief-parse';
export const QUEUE_DESIGN_DIRECTION = 'exhibition-design-direction';
export const QUEUE_AGENT_RUN = 'exhibition-agent-run';
export const QUEUE_EXPORT = 'exhibition-export';

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

export type BriefParseJobData = {
  taskId: string;
  projectId: string;
  outboxId: string;
};

export type DesignDirectionJobData = {
  taskId: string;
  projectId: string;
  outboxId: string;
};

export type AgentRunJobData = {
  taskId: string;
  projectId: string;
  conversationId: string;
  outboxId: string;
};

export type ExportJobData = {
  taskId: string;
  projectId: string;
  exportId: string;
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

export function createBriefParseQueue(config: QueueConfig) {
  return new Queue<BriefParseJobData>(QUEUE_BRIEF_PARSE, {
    connection: config.connection,
    defaultJobOptions: {
      removeOnComplete: { count: 100 },
      removeOnFail: { count: 500 },
    },
  });
}

export function createDesignDirectionQueue(config: QueueConfig) {
  return new Queue<DesignDirectionJobData>(QUEUE_DESIGN_DIRECTION, {
    connection: config.connection,
    defaultJobOptions: {
      removeOnComplete: { count: 100 },
      removeOnFail: { count: 500 },
    },
  });
}

export function createAgentRunQueue(config: QueueConfig) {
  return new Queue<AgentRunJobData>(QUEUE_AGENT_RUN, {
    connection: config.connection,
    defaultJobOptions: {
      removeOnComplete: { count: 100 },
      removeOnFail: { count: 500 },
    },
  });
}

export function createExportQueue(config: QueueConfig) {
  return new Queue<ExportJobData>(QUEUE_EXPORT, {
    connection: config.connection,
    defaultJobOptions: {
      removeOnComplete: { count: 100 },
      removeOnFail: { count: 500 },
    },
  });
}
