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
      mockResponse(req.promptSnapshot.templateId);
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

function mockResponse(templateId: string): string {
  if (templateId === 'brief_parse') {
    return JSON.stringify({
      title: 'Mock Exhibition',
      area: 36,
      orientation: 'front',
      budget: 200000,
      openDate: '2026-10-01',
      functionalZones: ['reception', 'display'],
      brandColors: ['#1A73E8'],
      missingFields: [],
    });
  }
  if (templateId === 'design_direction') {
    return JSON.stringify([
      {
        name: '现代科技',
        layoutConcept: '开放式中央展区布局',
        materialPalette: '铝材、玻璃和蓝色灯光',
        spatialFlow: '入口接待后环绕核心产品展示区',
        constraints: ['确认展馆限高', '复核消防通道'],
        humanReviewItems: ['确认最终预算'],
      },
      {
        name: '品牌沉浸',
        layoutConcept: '围合式叙事空间布局',
        materialPalette: '木饰面、织物和暖白照明',
        spatialFlow: '从品牌故事墙依次进入体验区和洽谈区',
        constraints: ['确认结构承重', '预留设备检修空间'],
        humanReviewItems: ['确认展品尺寸'],
      },
      {
        name: '模块化展示',
        layoutConcept: '可拆装模块化展台布局',
        materialPalette: '再生板材、金属框架和中性色彩',
        spatialFlow: '入口导览连接各独立产品模块',
        constraints: ['确认搭建工期', '核对用电负载'],
        humanReviewItems: ['确认现场搭建规范'],
      },
    ]);
  }
  return `[Mock Text Response] templateId=${templateId}`;
}
