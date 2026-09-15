import type {
  ImageProvider,
  ProviderModelConfig,
  TextProvider,
} from '../types.js';
import { ProviderError } from '../types.js';

export class ImageProviderRegistry {
  private readonly providers = new Map<string, ImageProvider>();
  private readonly configs = new Map<string, ProviderModelConfig>();

  register(config: ProviderModelConfig, provider: ImageProvider): this {
    if (!config.isActive) return this;
    this.configs.set(config.modelId, config);
    this.providers.set(config.modelId, provider);
    return this;
  }

  resolve(modelId: string): {
    provider: ImageProvider;
    config: ProviderModelConfig;
  } {
    const config = this.configs.get(modelId);
    const provider = this.providers.get(modelId);
    if (!config || !provider) {
      throw new ProviderError(
        'model_not_found',
        `Image model not found or not registered: ${modelId}`,
        false,
      );
    }
    if (!config.isActive) {
      throw new ProviderError(
        'model_disabled',
        `Image model is disabled: ${modelId}`,
        false,
      );
    }
    return { provider, config };
  }

  listActive(): ProviderModelConfig[] {
    return Array.from(this.configs.values()).filter(
      (config) => config.isActive,
    );
  }
}

export class TextProviderRegistry {
  private readonly providers = new Map<string, TextProvider>();

  register(providerId: string, provider: TextProvider): this {
    this.providers.set(providerId, provider);
    return this;
  }

  resolve(providerId: string): TextProvider {
    const provider = this.providers.get(providerId);
    if (!provider) {
      throw new ProviderError(
        'model_not_found',
        `Text provider not found: ${providerId}`,
        false,
      );
    }
    return provider;
  }
}
