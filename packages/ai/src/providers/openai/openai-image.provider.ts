import type {
  ImageGenerationOutput,
  ImageGenerationRequest,
  ImageGenerationResult,
  ImageProvider,
  ModelCapability,
} from '../../types.js';
import { ProviderError } from '../../types.js';

interface OpenAILike {
  images: {
    generate(body: {
      model: string;
      prompt: string;
      n?: number;
      size?: string;
      output_format?: 'png' | 'jpeg' | 'webp' | null;
    }): Promise<OpenAIImageResponse>;
    edit(body: {
      model: string;
      // image is typed as `any` so the provider can accept the result of toFile
      // (which returns Promise<unknown>) without importing Uploadable from openai.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      image: any;
      prompt: string;
      n?: number;
      size?: string;
    }): Promise<OpenAIImageResponse>;
  };
}

interface OpenAIImageResponse {
  data?: Array<{ b64_json?: string }>;
  usage?: unknown;
}

type ToFile = (
  buffer: Buffer,
  name: string,
  options?: { type?: string },
) => Promise<unknown>;

export interface OpenAIImageProviderOptions {
  client: OpenAILike;
  modelId: string;
  capability: ModelCapability;
  toFile: ToFile;
}

const DEFAULT_SIZE_PRESETS: Record<string, string> = {
  landscape_4_3: '1536x1024',
  landscape_16_9: '1536x1024',
  square_1_1: '1024x1024',
  portrait_3_4: '1024x1536',
  portrait_9_16: '1024x1536',
};

export class OpenAIImageProvider implements ImageProvider {
  readonly providerId = 'openai';
  readonly capability: ModelCapability;

  constructor(private readonly options: OpenAIImageProviderOptions) {
    this.capability = options.capability;
  }

  async generate(req: ImageGenerationRequest): Promise<ImageGenerationResult> {
    if (req.parentImageBytes !== undefined && !this.capability.supportsEdit) {
      throw new ProviderError(
        'capability_not_supported',
        'This OpenAI model does not support image edits',
        false,
      );
    }

    const size = resolveSize(req);

    try {
      const response =
        req.parentImageBytes === undefined
          ? await this.options.client.images.generate({
              model: this.options.modelId,
              prompt: req.resolvedPrompt,
              n: req.outputCount,
              size,
              output_format: 'png',
            })
          : await this.options.client.images.edit({
              model: this.options.modelId,
              image: await this.options.toFile(
                req.parentImageBytes,
                'parent.png',
                {
                  type: 'image/png',
                },
              ),
              prompt: req.resolvedPrompt,
              n: req.outputCount,
              size,
            });

      return {
        requestId: req.requestId,
        outputs: toOutputs(response.data),
        usageHint: isRecord(response.usage) ? response.usage : undefined,
      };
    } catch (error) {
      throw toProviderError(error);
    }
  }
}

function resolveSize(req: ImageGenerationRequest): string {
  const configuredSizes = req.modelConfig.providerConfig.sizePresetMap;
  const rawSize = isRecord(configuredSizes)
    ? configuredSizes[req.sizePreset]
    : undefined;
  const configuredSize = typeof rawSize === 'string' ? rawSize : undefined;
  const size = configuredSize ?? DEFAULT_SIZE_PRESETS[req.sizePreset];

  if (size === undefined) {
    throw new ProviderError(
      'parameter_invalid',
      `Unsupported OpenAI size preset: ${req.sizePreset}`,
      false,
    );
  }
  return size;
}

function toOutputs(data: OpenAIImageResponse['data']): ImageGenerationOutput[] {
  return (data ?? []).map((item, ordinal) => {
    if (item.b64_json === undefined) {
      return {
        ordinal,
        state: 'failed',
        errorCode: 'provider_error',
        errorMessage: 'OpenAI image response did not include image data',
      };
    }
    return {
      ordinal,
      state: 'succeeded',
      imageBytes: Buffer.from(item.b64_json, 'base64'),
      mimeType: 'image/png',
    };
  });
}

function toProviderError(error: unknown): ProviderError {
  const status = getStatus(error);
  const message = getMessage(error);

  if (status === 429) {
    return new ProviderError('rate_limited', message, true, error);
  }
  if (status === 401 || status === 403) {
    return new ProviderError('provider_error', message, false, error);
  }
  if (status === 400 && message.toLowerCase().includes('content_policy')) {
    return new ProviderError('content_rejected', message, false, error);
  }
  if (status === 400) {
    return new ProviderError('parameter_invalid', message, false, error);
  }
  return new ProviderError('provider_error', message, true, error);
}

function getStatus(error: unknown): number | undefined {
  if (!isRecord(error) || typeof error.status !== 'number') return undefined;
  return error.status;
}

function getMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (isRecord(error) && typeof error.message === 'string') {
    return error.message;
  }
  return 'OpenAI request failed';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
