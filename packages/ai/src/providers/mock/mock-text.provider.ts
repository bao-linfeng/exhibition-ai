import type {
  TextGenerationRequest,
  TextGenerationResult,
  TextProvider,
} from '../../types.js';
import { ProviderError } from '../../types.js';

export type MockTextScenario = 'success' | 'rejected' | 'accepted_unknown';

export interface MockTextProviderOptions {
  scenario?: MockTextScenario;
  responseOverride?: string;
  delayMs?: number;
}

export class MockTextProvider implements TextProvider {
  readonly providerId = 'mock-text';

  private callCount = 0;

  constructor(private readonly options: MockTextProviderOptions = {}) {}

  get calls(): number {
    return this.callCount;
  }

  resetStats(): void {
    this.callCount = 0;
  }

  async generate(req: TextGenerationRequest): Promise<TextGenerationResult> {
    this.callCount++;
    const scenario = this.options.scenario ?? 'success';
    const delayMs = this.options.delayMs ?? 0;

    if (delayMs > 0) {
      await new Promise<void>((resolve) => setTimeout(resolve, delayMs));
    }

    if (scenario === 'rejected') {
      throw new ProviderError(
        'content_rejected',
        'Mock: text content rejected by safety policy',
        false,
      );
    }
    if (scenario === 'accepted_unknown') {
      throw new ProviderError(
        'accepted_unknown',
        `Mock: text request ${req.requestId} accepted but result unknown`,
        false,
      );
    }

    const text =
      this.options.responseOverride ??
      `[Mock Text Response] templateId=${req.promptSnapshot.templateId} version=${req.promptSnapshot.version} requestId=${req.requestId}`;
    const promptTokens = Math.ceil(req.promptSnapshot.renderedText.length / 4);
    const completionTokens = Math.ceil(text.length / 4);

    return {
      requestId: req.requestId,
      text,
      usage: {
        promptTokens,
        completionTokens,
        totalTokens: promptTokens + completionTokens,
      },
    };
  }
}
