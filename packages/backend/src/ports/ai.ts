export interface PromptSnapshotPort {
  templateId: string;
  version: string;
  renderedText: string;
  snapshotAt: string;
}

export interface ImageOutputPort {
  ordinal: number;
  state: 'succeeded' | 'failed';
  imageBytes?: Buffer;
  mimeType?: string;
  errorCode?: string;
  errorMessage?: string;
}

export interface ImageGenerationResultPort {
  requestId: string;
  outputs: ImageOutputPort[];
  usageHint?: Record<string, unknown>;
}

export interface ImageProviderPort {
  readonly providerId: string;
  generate(req: {
    requestId: string;
    modelId: string;
    resolvedPrompt: string;
    promptSnapshot: PromptSnapshotPort;
    sizePreset: string;
    outputCount: number;
    seed?: number;
    negativePrompt?: string;
    parentImageBytes?: Buffer;
    parentImageMimeType?: string;
    maskBytes?: Buffer;
  }): Promise<ImageGenerationResultPort>;
}

export interface TextGenerationResultPort {
  requestId: string;
  text: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface TextProviderPort {
  readonly providerId: string;
  generate(req: {
    requestId: string;
    templateId: string;
    renderedPrompt: string;
    promptSnapshot: PromptSnapshotPort;
    variables: Record<string, string>;
  }): Promise<TextGenerationResultPort>;
}
