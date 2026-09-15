import type {
  TextGenerationRequest,
  TextGenerationResult,
  TextProvider,
} from '../../types.js';
import { ProviderError } from '../../types.js';

interface OpenAILike {
  responses: {
    create(body: { model: string; input: string; store?: boolean }): Promise<{
      output_text: string;
      usage?: {
        input_tokens: number;
        output_tokens: number;
        total_tokens: number;
      };
    }>;
  };
}

export interface OpenAITextProviderOptions {
  client: OpenAILike;
  modelId: string;
}

export class OpenAITextProvider implements TextProvider {
  readonly providerId = 'openai';

  constructor(private readonly options: OpenAITextProviderOptions) {}

  async generate(req: TextGenerationRequest): Promise<TextGenerationResult> {
    try {
      const response = await this.options.client.responses.create({
        model: this.options.modelId,
        input: req.promptSnapshot.renderedText,
        store: false,
      });
      const usage = response.usage;

      return {
        requestId: req.requestId,
        text: response.output_text,
        usage: {
          promptTokens: usage?.input_tokens ?? 0,
          completionTokens: usage?.output_tokens ?? 0,
          totalTokens: usage?.total_tokens ?? 0,
        },
      };
    } catch (error) {
      throw toProviderError(error);
    }
  }
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
