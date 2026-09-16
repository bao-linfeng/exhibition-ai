import type { AgentTool } from './types.js';

export function createBoothTools(): AgentTool[] {
  return [
    {
      name: 'get_brief',
      description:
        '获取当前项目的展览设计简报（Brief）内容，包括展台尺寸、品牌信息、预算、截止日期等',
      parametersSchema: { type: 'object', properties: {}, required: [] },
      async execute(_args, context) {
        return context.getBrief();
      },
    },
    {
      name: 'list_assets',
      description:
        '列出项目中已上传并通过验证的素材文件（Logo、产品图、参考图等）',
      parametersSchema: { type: 'object', properties: {}, required: [] },
      async execute(_args, context) {
        return context.listAssets();
      },
    },
    {
      name: 'list_versions',
      description: '列出项目中最近生成的图片版本',
      parametersSchema: { type: 'object', properties: {}, required: [] },
      async execute(_args, context) {
        return context.listVersions();
      },
    },
    {
      name: 'propose_brief_patch',
      description: '向用户提出修改展览设计简报的方案，用户审核确认后才会执行',
      parametersSchema: {
        type: 'object',
        properties: {
          patch: {
            type: 'object',
            description: '要更新的 Brief 字段（部分更新）',
          },
          reason: { type: 'string', description: '修改原因说明' },
        },
        required: ['patch', 'reason'],
      },
      async execute(args, context) {
        const { createHash } = await import('node:crypto');
        const payload = {
          action: 'apply_brief_patch',
          patch: args.patch,
          reason: args.reason,
        };
        const payloadHash = createHash('sha256')
          .update(JSON.stringify(payload))
          .digest('hex');
        const result = await context.createConfirmation({
          action: 'apply_brief_patch',
          payload: payload as Record<string, unknown>,
          payloadHash,
        });
        await context.onConfirmationCreated(result.confirmationId);
        return {
          confirmationId: result.confirmationId,
          message: '已创建 Brief 修改请求，等待您的确认',
        };
      },
    },
    {
      name: 'propose_generation',
      description: '向用户提出生成展览效果图的方案，用户审核确认后才会执行',
      parametersSchema: {
        type: 'object',
        properties: {
          instruction: { type: 'string', description: '生成指令' },
          sizePreset: {
            type: 'string',
            description: '尺寸规格（landscape_4_3/square_1_1 等）',
            default: 'landscape_4_3',
          },
          outputCount: {
            type: 'number',
            description: '生成数量（1-4）',
            default: 2,
          },
          estimatedFeeMinor: { type: 'number', description: '预计费用（分）' },
        },
        required: ['instruction'],
      },
      async execute(args, context) {
        const { createHash } = await import('node:crypto');
        const payload = {
          action: 'create_generation',
          instruction: args.instruction,
          sizePreset: args.sizePreset ?? 'landscape_4_3',
          outputCount: args.outputCount ?? 2,
        };
        const payloadHash = createHash('sha256')
          .update(JSON.stringify(payload))
          .digest('hex');
        const result = await context.createConfirmation({
          action: 'create_generation',
          payload: payload as Record<string, unknown>,
          payloadHash,
          estimatedFeeMinor:
            typeof args.estimatedFeeMinor === 'number'
              ? args.estimatedFeeMinor
              : undefined,
          currency: 'CNY',
        });
        await context.onConfirmationCreated(result.confirmationId);
        return {
          confirmationId: result.confirmationId,
          message: '已创建生成请求，等待您的确认',
        };
      },
    },
  ];
}
