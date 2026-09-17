import type {
  ImageProvider,
  ProviderModelConfig,
  TextProvider,
} from '../types.js';
import { ProviderError } from '../types.js';

export class ImageProviderRegistry {
  private readonly providers = new Map<string, ImageProvider>();
  private readonly configs = new Map<string, ProviderModelConfig>();
  private readonly key = (providerId: string, modelId: string) =>
    `${providerId}:${modelId}`;

  register(config: ProviderModelConfig, provider: ImageProvider): this {
    if (!config.isActive) return this;
    const key = this.key(config.providerId, config.modelId);
    this.configs.set(key, config);
    this.providers.set(key, provider);
    return this;
  }

  resolve(
    providerId: string,
    modelId: string,
  ): {
    provider: ImageProvider;
    config: ProviderModelConfig;
  } {
    const key = this.key(providerId, modelId);
    const config = this.configs.get(key);
    const provider = this.providers.get(key);
    if (!config || !provider) {
      throw new ProviderError(
        'model_not_found',
        `Image provider not found or not registered: ${providerId}/${modelId}`,
        false,
      );
    }
    if (!config.isActive) {
      throw new ProviderError(
        'model_disabled',
        `Image provider is disabled: ${providerId}/${modelId}`,
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
