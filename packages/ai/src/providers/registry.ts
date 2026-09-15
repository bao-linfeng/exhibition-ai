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
    this.configs.set(config.providerId, config);
    this.providers.set(config.providerId, provider);
    return this;
  }

  resolve(providerId: string): {
    provider: ImageProvider;
    config: ProviderModelConfig;
  } {
    const config = this.configs.get(providerId);
    const provider = this.providers.get(providerId);
    if (!config || !provider) {
      throw new ProviderError(
        'model_not_found',
        `Image provider not found or not registered: ${providerId}`,
        false,
      );
    }
    if (!config.isActive) {
      throw new ProviderError(
        'model_disabled',
        `Image provider is disabled: ${providerId}`,
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
