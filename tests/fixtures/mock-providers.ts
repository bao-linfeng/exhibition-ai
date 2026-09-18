import {
  BUILTIN_TEMPLATES,
  ImageProviderRegistry,
  MockImageProvider,
  MockTextProvider,
  PromptRegistry,
  TextProviderRegistry,
} from '@exhibition/ai';
import type { ProviderModelConfig } from '@exhibition/ai';

export const MOCK_MODEL_CONFIG_FULL: ProviderModelConfig = {
  providerId: 'mock',
  modelId: 'mock-full',
  displayName: 'Mock Model (Full Capabilities)',
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

export const MOCK_MODEL_CONFIG_NO_EDIT: ProviderModelConfig = {
  providerId: 'mock',
  modelId: 'mock-no-edit',
  displayName: 'Mock Model (Generate Only)',
  isActive: true,
  capability: {
    supportsGenerate: true,
    supportsEdit: false,
    supportedSizePresets: ['landscape_4_3', 'square_1_1'],
    maxOutputCount: 2,
    supportsSeed: false,
    supportsNegativePrompt: false,
    supportsReferenceAssets: false,
  },
  providerConfig: {},
};

export const MOCK_MODEL_CONFIG_DISABLED: ProviderModelConfig = {
  providerId: 'mock',
  modelId: 'mock-disabled',
  displayName: 'Mock Model (Disabled)',
  isActive: false,
  capability: {
    supportsGenerate: true,
    supportsEdit: false,
    supportedSizePresets: ['square_1_1'],
    maxOutputCount: 1,
    supportsSeed: false,
    supportsNegativePrompt: false,
    supportsReferenceAssets: false,
  },
  providerConfig: {},
};

export function createMockPromptRegistry(): PromptRegistry {
  const registry = new PromptRegistry();
  for (const template of BUILTIN_TEMPLATES) {
    registry.register(template);
  }
  return registry;
}

export function createMockImageProviderRegistry(opts?: {
  scenario?: import('@exhibition/ai').MockScenario;
  delayMs?: number;
}): ImageProviderRegistry {
  const registry = new ImageProviderRegistry();
  const provider = new MockImageProvider({
    scenario: opts?.scenario ?? 'success',
    delayMs: opts?.delayMs,
  });
  registry.register(MOCK_MODEL_CONFIG_FULL, provider);
  registry.register(
    MOCK_MODEL_CONFIG_NO_EDIT,
    new MockImageProvider(
      {},
      {
        supportsGenerate: true,
        supportsEdit: false,
        supportedSizePresets: ['landscape_4_3', 'square_1_1'],
        maxOutputCount: 2,
        supportsSeed: false,
        supportsNegativePrompt: false,
        supportsReferenceAssets: false,
      },
    ),
  );
  registry.register(MOCK_MODEL_CONFIG_DISABLED, new MockImageProvider());
  return registry;
}

export function createMockTextProviderRegistry(opts?: {
  scenario?: import('@exhibition/ai').MockTextScenario;
}): TextProviderRegistry {
  const registry = new TextProviderRegistry();
  registry.register(
    'mock-text',
    new MockTextProvider({ scenario: opts?.scenario ?? 'success' }),
  );
  return registry;
}
