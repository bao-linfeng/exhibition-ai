import {
  BUILTIN_TEMPLATES,
  ImageProviderRegistry,
  MockImageProvider,
  MockTextProvider,
  PromptRegistry,
  TextProviderRegistry,
} from '@exhibition/ai';
import type { ProviderModelConfig } from '@exhibition/ai';
import { logger } from '@exhibition/backend';

const MOCK_FULL_CONFIG: ProviderModelConfig = {
  providerId: 'mock',
  modelId: 'mock-full',
  displayName: 'Mock Image Model (Full)',
  isActive: true,
  capability: {
    supportsGenerate: true,
    supportsEdit: true,
    supportedSizePresets: [
      'landscape_4_3',
      'landscape_16_9',
      'square_1_1',
      'portrait_3_4',
      'portrait_9_16',
    ],
    maxOutputCount: 4,
    supportsSeed: true,
    supportsNegativePrompt: true,
  },
  providerConfig: {},
};

export interface BootstrappedProviders {
  imageProviderRegistry: ImageProviderRegistry;
  textProviderRegistry: TextProviderRegistry;
  promptRegistry: PromptRegistry;
}

export function bootstrapProviders(): BootstrappedProviders {
  const promptRegistry = new PromptRegistry();
  for (const template of BUILTIN_TEMPLATES) {
    promptRegistry.register(template);
  }
  logger.info(
    { templates: promptRegistry.listMetadata() },
    'Prompt registry initialized',
  );

  const imageProviderRegistry = new ImageProviderRegistry();
  imageProviderRegistry.register(MOCK_FULL_CONFIG, new MockImageProvider());
  logger.info(
    {
      models: imageProviderRegistry
        .listActive()
        .map((config) => config.modelId),
    },
    'Image provider registry initialized',
  );

  const textProviderRegistry = new TextProviderRegistry();
  textProviderRegistry.register('mock-text', new MockTextProvider());
  logger.info('Text provider registry initialized');

  return { imageProviderRegistry, textProviderRegistry, promptRegistry };
}
