import {
  BUILTIN_TEMPLATES,
  ImageProviderRegistry,
  MockImageProvider,
  MockTextProvider,
  OpenAIImageProvider,
  OpenAITextProvider,
  PromptRegistry,
  TextProviderRegistry,
} from '@exhibition/ai';
import type { ProviderModelConfig } from '@exhibition/ai';
import { env, logger } from '@exhibition/backend';
import OpenAI, { toFile } from 'openai';

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

const OPENAI_IMAGE_CONFIG: ProviderModelConfig = {
  providerId: 'openai',
  modelId: 'gpt-image-2',
  displayName: 'GPT Image 2 (OpenAI)',
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
    supportsSeed: false,
    supportsNegativePrompt: false,
  },
  providerConfig: { outputFormat: 'png', quality: 'medium' },
};

export interface BootstrappedProviders {
  imageProviderRegistry: ImageProviderRegistry;
  textProviderRegistry: TextProviderRegistry;
  promptRegistry: PromptRegistry;
  defaultTextProviderId: string;
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
  const textProviderRegistry = new TextProviderRegistry();
  let defaultTextProviderId: string;

  if (env.AI_PROVIDER_MODE === 'real' && env.OPENAI_API_KEY) {
    logger.info(
      { mode: 'real', imageModel: OPENAI_IMAGE_CONFIG.modelId },
      'Initializing real OpenAI providers',
    );

    const openaiClient = new OpenAI({ apiKey: env.OPENAI_API_KEY });

    const textProvider = new OpenAITextProvider({
      client: openaiClient,
      modelId: env.AI_DEFAULT_TEXT_MODEL ?? 'gpt-5.6-terra',
    });
    textProviderRegistry.register('openai', textProvider);
    defaultTextProviderId = 'openai';

    const imageProvider = new OpenAIImageProvider({
      client: openaiClient,
      modelId: OPENAI_IMAGE_CONFIG.modelId,
      capability: OPENAI_IMAGE_CONFIG.capability,
      toFile: (buffer: Buffer, name: string, opts?: { type?: string }) =>
        toFile(buffer, name, opts),
    });
    imageProviderRegistry.register(OPENAI_IMAGE_CONFIG, imageProvider);
  } else {
    if (env.AI_PROVIDER_MODE === 'real' && !env.OPENAI_API_KEY) {
      logger.warn(
        'AI_PROVIDER_MODE=real but OPENAI_API_KEY is missing — falling back to mock',
      );
    }
    imageProviderRegistry.register(MOCK_FULL_CONFIG, new MockImageProvider());
    textProviderRegistry.register('mock-text', new MockTextProvider());
    defaultTextProviderId = 'mock-text';
  }

  logger.info(
    { models: imageProviderRegistry.listActive().map((c) => c.modelId) },
    'Image provider registry initialized',
  );
  logger.info({ defaultTextProviderId }, 'Text provider registry initialized');

  return {
    imageProviderRegistry,
    textProviderRegistry,
    promptRegistry,
    defaultTextProviderId,
  };
}
