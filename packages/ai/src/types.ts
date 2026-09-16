export type ProviderErrorCode =
  | 'model_not_found'
  | 'model_disabled'
  | 'capability_not_supported'
  | 'parameter_invalid'
  | 'quota_exceeded'
  | 'content_rejected'
  | 'rate_limited'
  | 'timeout'
  | 'provider_error'
  | 'accepted_unknown';

export type ProviderAcceptance = 'rejected' | 'accepted_unknown';

export class ProviderError extends Error {
  constructor(
    public readonly code: ProviderErrorCode,
    message: string,
    public readonly retryable: boolean = false,
    public readonly raw?: unknown,
    public readonly acceptance: ProviderAcceptance = 'rejected',
  ) {
    super(message);
    this.name = 'ProviderError';
  }
}

export interface ModelCapability {
  supportsGenerate: boolean;
  supportsEdit: boolean;
  supportedSizePresets: string[];
  maxOutputCount: number;
  supportsSeed: boolean;
  supportsNegativePrompt: boolean;
}

export interface ProviderModelConfig {
  providerId: string;
  modelId: string;
  displayName: string;
  isActive: boolean;
  capability: ModelCapability;
  providerConfig: Record<string, unknown>;
}

export interface TextGenerationRequest {
  requestId: string;
  promptSnapshot: PromptSnapshot;
  variables: Record<string, string>;
}

export interface TextGenerationResult {
  requestId: string;
  text: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface TextProvider {
  readonly providerId: string;
  generate(req: TextGenerationRequest): Promise<TextGenerationResult>;
}

export interface ImageGenerationRequest {
  requestId: string;
  modelConfig: ProviderModelConfig;
  promptSnapshot: PromptSnapshot;
  resolvedPrompt: string;
  sizePreset: string;
  outputCount: number;
  seed?: number;
  negativePrompt?: string;
  parentImageBytes?: Buffer;
  parentImageMimeType?: string;
  maskBytes?: Buffer;
}

export interface ImageGenerationOutput {
  ordinal: number;
  state: 'succeeded' | 'failed';
  imageBytes?: Buffer;
  mimeType?: string;
  errorCode?: string;
  errorMessage?: string;
}

export interface ImageGenerationResult {
  requestId: string;
  outputs: ImageGenerationOutput[];
  usageHint?: Record<string, unknown>;
}

export interface ImageProvider {
  readonly providerId: string;
  readonly capability: ModelCapability;
  generate(req: ImageGenerationRequest): Promise<ImageGenerationResult>;
}

export interface PromptSnapshot {
  templateId: string;
  version: string;
  templateText: string;
  renderedText: string;
  variables: Record<string, string>;
  snapshotAt: string;
}
