import type {
  ImageGenerationOutput,
  ImageGenerationRequest,
  ImageGenerationResult,
  ImageProvider,
  ModelCapability,
} from '../../types.js';
import { ProviderError } from '../../types.js';
import type { GoogleGenerativeAI } from '@google/generative-ai';

export interface GeminiImageProviderOptions {
  client: GoogleGenerativeAI;
  modelId: string;
  capability: ModelCapability;
}

const SIZE_ASPECT_RATIO: Record<string, string> = {
  landscape_4_3: '4:3 aspect ratio, landscape orientation',
  landscape_16_9: '16:9 aspect ratio, widescreen landscape',
  square_1_1: '1:1 aspect ratio, square format',
  portrait_3_4: '3:4 aspect ratio, portrait orientation',
  portrait_9_16: '9:16 aspect ratio, tall portrait, mobile format',
};

export class GeminiImageProvider implements ImageProvider {
  readonly providerId = 'google';
  readonly capability: ModelCapability;

  constructor(private readonly options: GeminiImageProviderOptions) {
    this.capability = options.capability;
  }

  async generate(req: ImageGenerationRequest): Promise<ImageGenerationResult> {
    if (req.parentImageBytes !== undefined && !this.capability.supportsEdit) {
      throw new ProviderError(
        'capability_not_supported',
        'This Gemini model does not support image edits',
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
        'This Gemini model does not support reference assets',
        false,
      );
    }

    const outputs: ImageGenerationOutput[] = [];

    try {
      // Gemini 图片生成通过多次调用实现多图输出
      for (let i = 0; i < req.outputCount; i++) {
        try {
          const prompt = buildPrompt(req);

          const model = this.options.client.getGenerativeModel({
            model: this.options.modelId,
            // responseModalities is supported at runtime but not in @google/generative-ai@0.24.1 types
            generationConfig: {
              responseModalities: ['IMAGE'],
            } as Record<string, unknown>,
          });

          // 构建请求内容
          const textPart = { text: prompt };
          const parts: Array<
            | { text: string }
            | { inlineData: { mimeType: string; data: string } }
          > = [];

          // 如果有父图片（编辑模式），添加图片数据
          if (req.parentImageBytes) {
            parts.push({
              inlineData: {
                mimeType: req.parentImageMimeType ?? 'image/png',
                data: req.parentImageBytes.toString('base64'),
              },
            });
          }

          parts.push(textPart);

          const response = await model.generateContent({
            contents: [{ role: 'user', parts }],
          });

          const candidate = response.response?.candidates?.[0];
          if (!candidate) {
            outputs.push({
              ordinal: i,
              state: 'failed',
              errorCode: 'provider_error',
              errorMessage: 'Gemini returned no candidates',
            });
            continue;
          }

          if (candidate.finishReason === 'SAFETY') {
            outputs.push({
              ordinal: i,
              state: 'failed',
              errorCode: 'content_rejected',
              errorMessage: 'Content blocked by safety filters',
            });
            continue;
          }

          const responseParts = candidate.content?.parts;
          if (!responseParts) {
            outputs.push({
              ordinal: i,
              state: 'failed',
              errorCode: 'provider_error',
              errorMessage: 'Gemini response has no content parts',
            });
            continue;
          }

          const imagePart = responseParts.find(
            (part: { inlineData?: { data: string; mimeType?: string } }) =>
              part.inlineData,
          );
          if (!imagePart?.inlineData) {
            outputs.push({
              ordinal: i,
              state: 'failed',
              errorCode: 'provider_error',
              errorMessage: 'Gemini response did not include image data',
            });
            continue;
          }

          outputs.push({
            ordinal: i,
            state: 'succeeded',
            imageBytes: Buffer.from(imagePart.inlineData.data, 'base64'),
            mimeType: imagePart.inlineData.mimeType || 'image/png',
          });
        } catch (error) {
          outputs.push({
            ordinal: i,
            state: 'failed',
            errorCode: 'provider_error',
            errorMessage:
              error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      return {
        requestId: req.requestId,
        outputs,
        usageHint: undefined,
      };
    } catch (error) {
      if (error instanceof ProviderError) {
        throw error;
      }
      throw toProviderError(error);
    }
  }
}

function buildPrompt(req: ImageGenerationRequest): string {
  let prompt = req.resolvedPrompt;

  const aspectRatioHint = SIZE_ASPECT_RATIO[req.sizePreset] ?? '';
  if (aspectRatioHint) {
    prompt += `\n\nCompose the image in ${aspectRatioHint}.`;
  }

  // 添加负面提示（如果支持）
  if (req.negativePrompt) {
    prompt += `\n\nAvoid the following: ${req.negativePrompt}`;
  }

  return prompt;
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
  if (status === 400 && message.toLowerCase().includes('safety')) {
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
  if (!isRecord(error)) return undefined;
  if (typeof error.status === 'number') return error.status;
  if (isRecord(error.response) && typeof error.response.status === 'number') {
    return error.response.status;
  }
  return undefined;
}

function getMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (isRecord(error) && typeof error.message === 'string') {
    return error.message;
  }
  return 'Gemini request failed';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
