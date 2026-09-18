import type {
  ImageGenerationRequest,
  ImageGenerationResult,
  ImageProvider,
  ModelCapability,
} from '../../types.js';
import { ProviderError } from '../../types.js';

export type MockScenario =
  | 'success'
  | 'delay'
  | 'partial_failure'
  | 'rejected'
  | 'accepted_unknown'
  | 'duplicate';

export interface MockImageProviderOptions {
  scenario?: MockScenario;
  delayMs?: number;
  failedOrdinals?: number[];
  imageBytesOverride?: Buffer;
}

const MOCK_PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);

export class MockImageProvider implements ImageProvider {
  readonly providerId = 'mock';

  private callCount = 0;
  private lastRequestId: string | null = null;
  private lastResult: ImageGenerationResult | null = null;

  constructor(
    private readonly options: MockImageProviderOptions = {},
    private readonly _capability: ModelCapability = {
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
  ) {}

  get capability(): ModelCapability {
    return this._capability;
  }

  get calls(): number {
    return this.callCount;
  }

  resetStats(): void {
    this.callCount = 0;
    this.lastRequestId = null;
    this.lastResult = null;
  }

  async generate(req: ImageGenerationRequest): Promise<ImageGenerationResult> {
    this.callCount++;
    const scenario = this.options.scenario ?? 'success';
    const delayMs = this.options.delayMs ?? 0;

    if (!this._capability.supportsEdit && req.parentImageBytes !== undefined) {
      throw new ProviderError(
        'capability_not_supported',
        'This mock model does not support edit mode',
        false,
      );
    }
    if (req.outputCount > this._capability.maxOutputCount) {
      throw new ProviderError(
        'parameter_invalid',
        `outputCount ${req.outputCount} exceeds maxOutputCount ${this._capability.maxOutputCount}`,
        false,
      );
    }
    if (!this._capability.supportedSizePresets.includes(req.sizePreset)) {
      throw new ProviderError(
        'parameter_invalid',
        `sizePreset "${req.sizePreset}" is not supported`,
        false,
      );
    }
    if (
      !this._capability.supportsReferenceAssets &&
      req.referenceAssets !== undefined &&
      req.referenceAssets.length > 0
    ) {
      throw new ProviderError(
        'capability_not_supported',
        'This mock model does not support reference assets',
        false,
      );
    }

    if (delayMs > 0) {
      await new Promise<void>((resolve) => setTimeout(resolve, delayMs));
    }

    if (
      scenario === 'duplicate' &&
      req.requestId === this.lastRequestId &&
      this.lastResult !== null
    ) {
      return this.lastResult;
    }

    if (scenario === 'rejected') {
      throw new ProviderError(
        'content_rejected',
        'Mock: content rejected by safety policy',
        false,
      );
    }

    if (scenario === 'accepted_unknown') {
      throw new ProviderError(
        'accepted_unknown',
        `Mock: request ${req.requestId} accepted but result unknown`,
        false,
        { requestId: req.requestId },
        'accepted_unknown',
      );
    }

    const imageBytes = this.options.imageBytesOverride ?? MOCK_PNG_1X1;
    const failedOrdinals =
      this.options.failedOrdinals ??
      (scenario === 'partial_failure' ? [req.outputCount - 1] : []);
    const outputs = Array.from({ length: req.outputCount }, (_, ordinal) => {
      const failed = failedOrdinals.includes(ordinal);
      return failed
        ? {
            ordinal,
            state: 'failed' as const,
            errorCode: 'mock_partial_failure',
            errorMessage: 'Mock: simulated partial output failure',
          }
        : {
            ordinal,
            state: 'succeeded' as const,
            imageBytes,
            mimeType: 'image/png',
          };
    });

    const result: ImageGenerationResult = {
      requestId: req.requestId,
      outputs,
      usageHint: {
        provider: 'mock',
        scenario,
        callCount: this.callCount,
        promptSnapshotVersion: req.promptSnapshot.version,
        referenceAssetCount: req.referenceAssets?.length ?? 0,
      },
    };

    this.lastRequestId = req.requestId;
    this.lastResult = result;
    return result;
  }
}
