import type { PromptTemplate } from './registry.js';

export const BUILTIN_TEMPLATES: PromptTemplate[] = [
  {
    id: 'brief_parse',
    version: '2026-09-15.1',
    text: `你是一位展览设计专家。请从以下客户描述中提取结构化展览设计需求。

客户描述：
{{client_description}}

请以 JSON 格式返回，包含字段：title（展览名称）、area（面积平方米，数字）、orientation（朝向）、budget（预算，数字，人民币元）、openDate（开幕日期 YYYY-MM-DD）、functionalZones（功能区列表）、brandColors（品牌色列表 #RRGGBB）、missingFields（缺失或需核对的字段列表）。`,
  },
  {
    id: 'design_direction',
    version: '2026-09-15.1',
    text: `你是一位资深展览空间设计师。基于以下展览设计简报，提出 3 个差异化的设计方向。

展览简报摘要：
{{brief_summary}}

每个设计方向应包含：name（名称）、layoutConcept（布局概念）、materialPalette（材料与配色方案）、spatialFlow（空间流线说明）、constraints（注意事项，包括结构或规范限制）、humanReviewItems（需要人工核实的项目）。

以 JSON 数组格式返回，严格遵守展览行业安全和施工规范，不宣称绝对精确的施工数据。`,
  },
  {
    id: 'image_generation_prompt',
    version: '2026-09-15.1',
    text: `展览空间效果图，{{instruction}}。

设计方向：{{direction}}
尺寸规格：{{size_preset}}
风格要求：专业展览设计，高品质渲染，真实材质表现{{negative_prompt_suffix}}`,
  },
];
