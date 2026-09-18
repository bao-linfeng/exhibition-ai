import {
  BUILTIN_TEMPLATES,
  ImageProviderRegistry,
  MockImageProvider,
  MockTextProvider,
  OpenAIImageProvider,
  OpenAITextProvider,
  GeminiImageProvider,
  PromptRegistry,
  TextProviderRegistry,
} from '@exhibition/ai';
import type { ProviderModelConfig } from '@exhibition/ai';
import { env, logger } from '@exhibition/backend';
import OpenAI, { toFile } from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';

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
    supportsReferenceAssets: true,
  },
  providerConfig: {},
};

const OPENAI_IMAGE_CONFIG: ProviderModelConfig = {
  providerId: 'openai',
  modelId: env.AI_DEFAULT_IMAGE_MODEL ?? 'gpt-image-2.5-flare',
  displayName: 'GPT Image (OpenAI Compatible)',
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
    supportsReferenceAssets: false,
  },
  providerConfig: {
    outputFormat: 'png',
    quality: env.AI_DEFAULT_IMAGE_QUALITY ?? 'medium',
  },
};

const GEMINI_FLASH_IMAGE_CONFIG: ProviderModelConfig = {
  providerId: 'google',
  modelId: 'gemini-3.1-flash-image',
  displayName: 'Gemini 3.1 Flash Image',
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
    supportsNegativePrompt: true,
    supportsReferenceAssets: false,
  },
  providerConfig: {},
};

const GEMINI_FLASH_LITE_IMAGE_CONFIG: ProviderModelConfig = {
  providerId: 'google',
  modelId: 'gemini-3.1-flash-lite-image',
  displayName: 'Gemini 3.1 Flash Lite Image',
  isActive: true,
  capability: {
    supportsGenerate: true,
    supportsEdit: false,
    supportedSizePresets: [
      'landscape_4_3',
      'landscape_16_9',
      'square_1_1',
      'portrait_3_4',
      'portrait_9_16',
    ],
    maxOutputCount: 4,
    supportsSeed: false,
    supportsNegativePrompt: true,
    supportsReferenceAssets: false,
  },
  providerConfig: {},
};

const GEMINI_PRO_IMAGE_CONFIG: ProviderModelConfig = {
  providerId: 'google',
  modelId: 'gemini-3-pro-image',
  displayName: 'Gemini 3 Pro Image',
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
    supportsNegativePrompt: true,
    supportsReferenceAssets: false,
  },
  providerConfig: {},
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
  let defaultTextProviderId = 'mock-text';

  if (
    env.AI_PROVIDER_MODE === 'real' &&
    (env.OPENAI_API_KEY || env.GOOGLE_API_KEY)
  ) {
    logger.info({ mode: 'real' }, 'Initializing real AI providers');

    // OpenAI Provider
    if (env.OPENAI_API_KEY) {
      const openaiClient = new OpenAI({
        apiKey: env.OPENAI_API_KEY,
        baseURL: env.OPENAI_BASE_URL,
        maxRetries: 0,
      });

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
      logger.info(
        { model: OPENAI_IMAGE_CONFIG.modelId },
        'OpenAI image provider initialized',
      );
    }

    // Google Gemini Provider
    if (env.GOOGLE_API_KEY) {
      const geminiClient = new GoogleGenerativeAI(env.GOOGLE_API_KEY);

      const geminiFlashProvider = new GeminiImageProvider({
        client: geminiClient,
        modelId: GEMINI_FLASH_IMAGE_CONFIG.modelId,
        capability: GEMINI_FLASH_IMAGE_CONFIG.capability,
      });
      imageProviderRegistry.register(
        GEMINI_FLASH_IMAGE_CONFIG,
        geminiFlashProvider,
      );

      const geminiFlashLiteProvider = new GeminiImageProvider({
        client: geminiClient,
        modelId: GEMINI_FLASH_LITE_IMAGE_CONFIG.modelId,
        capability: GEMINI_FLASH_LITE_IMAGE_CONFIG.capability,
      });
      imageProviderRegistry.register(
        GEMINI_FLASH_LITE_IMAGE_CONFIG,
        geminiFlashLiteProvider,
      );

      const geminiProProvider = new GeminiImageProvider({
        client: geminiClient,
        modelId: GEMINI_PRO_IMAGE_CONFIG.modelId,
        capability: GEMINI_PRO_IMAGE_CONFIG.capability,
      });
      imageProviderRegistry.register(
        GEMINI_PRO_IMAGE_CONFIG,
        geminiProProvider,
      );

      logger.info(
        {
          models: [
            'gemini-3.1-flash-image',
            'gemini-3.1-flash-lite-image',
            'gemini-3-pro-image',
          ],
        },
        'Google Gemini image providers initialized',
      );
    }

    if (!env.OPENAI_API_KEY && !env.GOOGLE_API_KEY) {
      logger.warn(
        'AI_PROVIDER_MODE=real but no API keys provided — falling back to mock',
      );
      imageProviderRegistry.register(MOCK_FULL_CONFIG, new MockImageProvider());
      textProviderRegistry.register('mock-text', new MockTextProvider());
    }
  } else {
    if (env.AI_PROVIDER_MODE === 'real') {
      logger.warn(
        'AI_PROVIDER_MODE=real but no API keys provided — falling back to mock',
      );
    }
    imageProviderRegistry.register(MOCK_FULL_CONFIG, new MockImageProvider());
    textProviderRegistry.register('mock-text', new MockTextProvider());
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
