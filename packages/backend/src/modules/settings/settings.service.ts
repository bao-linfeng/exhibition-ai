import type { UpdateModelConfigRequest } from '@exhibition/contracts';
import type { ModelConfig } from '@exhibition/db';
import type { ModelConfigRepository } from './model-config.repository.js';

export class SettingsService {
  constructor(private readonly modelConfigRepo: ModelConfigRepository) {}

  async listModelConfigs(activeOnly = false): Promise<ModelConfig[]> {
    return this.modelConfigRepo.findAll(activeOnly);
  }

  async getModelConfig(id: string): Promise<ModelConfig | undefined> {
    return this.modelConfigRepo.findById(id);
  }

  async updateModelConfig(
    id: string,
    patch: UpdateModelConfigRequest,
  ): Promise<ModelConfig | undefined> {
    return this.modelConfigRepo.update(id, patch);
  }

  async registerModelConfig(input: {
    providerId: string;
    modelId: string;
    displayName: string;
    description?: string;
    capabilities?: string[];
    costPerImageMinor?: number;
    currency?: string;
    maxConcurrent?: number;
  }): Promise<ModelConfig> {
    return this.modelConfigRepo.upsert({
      providerId: input.providerId,
      modelId: input.modelId,
      displayName: input.displayName,
      description: input.description ?? null,
      capabilities: input.capabilities ?? [],
      costPerImageMinor: input.costPerImageMinor ?? 0,
      currency: input.currency ?? 'CNY',
      isActive: true,
      maxConcurrent: input.maxConcurrent ?? 2,
      parametersSchema: {},
    });
  }
}
