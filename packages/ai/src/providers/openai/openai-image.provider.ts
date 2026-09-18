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
      quality?: ImageQuality;
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
      quality?: ImageQuality;
      output_format?: 'png' | 'jpeg' | 'webp' | null;
    }): Promise<OpenAIImageResponse>;
  };
}

interface OpenAIImageResponse {
  data?: Array<{ b64_json?: string }>;
  usage?: unknown;
}

type ImageQuality = 'low' | 'medium' | 'high' | 'xhigh' | 'max' | 'auto';
type ImageOutputFormat = 'png' | 'jpeg' | 'webp';

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
    if (
      req.referenceAssets !== undefined &&
      req.referenceAssets.length > 0 &&
      !this.capability.supportsReferenceAssets
    ) {
      throw new ProviderError(
        'capability_not_supported',
        'This OpenAI model does not support reference assets',
        false,
      );
    }

    const size = resolveSize(req);
    const quality = resolveQuality(req);
    const outputFormat = resolveOutputFormat(req);

    try {
      const response =
        req.parentImageBytes === undefined
          ? await this.options.client.images.generate({
              model: this.options.modelId,
              prompt: req.resolvedPrompt,
              n: req.outputCount,
              size,
              quality,
              output_format: outputFormat,
            })
          : await this.options.client.images.edit({
              model: this.options.modelId,
              image: await this.options.toFile(
                req.parentImageBytes,
                `parent.${mimeToExtension(req.parentImageMimeType)}`,
                {
                  type: resolveParentImageMimeType(req.parentImageMimeType),
                },
              ),
              prompt: req.resolvedPrompt,
              n: req.outputCount,
              size,
              quality,
              output_format: outputFormat,
            });

      return {
        requestId: req.requestId,
        outputs: toOutputs(response.data, outputFormat),
        usageHint: isRecord(response.usage) ? response.usage : undefined,
      };
    } catch (error) {
      if (error instanceof ProviderError) {
        throw error;
      }
      throw toProviderError(error);
    }
  }
}

function resolveParentImageMimeType(mimeType: string | undefined): string {
  if (
    mimeType === 'image/png' ||
    mimeType === 'image/jpeg' ||
    mimeType === 'image/webp'
  ) {
    return mimeType;
  }
  throw new ProviderError(
    'parameter_invalid',
    `Unsupported parent image MIME type: ${mimeType ?? 'unknown'}`,
    false,
  );
}

function mimeToExtension(mimeType: string | undefined): string {
  switch (resolveParentImageMimeType(mimeType)) {
    case 'image/jpeg':
      return 'jpg';
    case 'image/webp':
      return 'webp';
    default:
      return 'png';
  }
}

function resolveQuality(req: ImageGenerationRequest): ImageQuality {
  const quality = req.modelConfig.providerConfig.quality;
  if (
    quality === 'low' ||
    quality === 'medium' ||
    quality === 'high' ||
    quality === 'xhigh' ||
    quality === 'max' ||
    quality === 'auto'
  ) {
    return quality;
  }
  return 'medium';
}

function resolveOutputFormat(req: ImageGenerationRequest): ImageOutputFormat {
  const outputFormat = req.modelConfig.providerConfig.outputFormat;
  if (
    outputFormat === 'png' ||
    outputFormat === 'jpeg' ||
    outputFormat === 'webp'
  ) {
    return outputFormat;
  }
  return 'png';
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

function toOutputs(
  data: OpenAIImageResponse['data'],
  outputFormat: ImageOutputFormat,
): ImageGenerationOutput[] {
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
      mimeType:
        outputFormat === 'jpeg' ? 'image/jpeg' : `image/${outputFormat}`,
    };
  });
}

function toProviderError(error: unknown): ProviderError {
  const status = getStatus(error);
  const message = getMessage(error);

  if (status === 429) {
    return new ProviderError('rate_limited', message, false, error, 'rejected');
  }
  if (status === 401 || status === 403) {
    return new ProviderError(
      'provider_error',
      message,
      false,
      error,
      'rejected',
    );
  }
  if (status === 404) {
    return new ProviderError(
      'model_not_found',
      message,
      false,
      error,
      'rejected',
    );
  }
  if (status === 400 && message.toLowerCase().includes('content_policy')) {
    return new ProviderError('content_rejected', message, false, error);
  }
  if (status === 400) {
    return new ProviderError('parameter_invalid', message, false, error);
  }
  return new ProviderError(
    'accepted_unknown',
    message,
    false,
    error,
    'accepted_unknown',
  );
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
