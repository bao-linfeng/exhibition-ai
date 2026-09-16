import type { PromptSnapshot, TextProvider } from '../types.js';
import type {
  AgentMessage,
  AgentRunContext,
  AgentRunOptions,
  AgentRunResult,
  AgentTool,
  MessagePart,
  ToolResult,
} from './types.js';

const DEFAULT_OPTIONS: AgentRunOptions = {
  maxToolCalls: 8,
  maxDurationMs: 120_000,
  maxRepairAttempts: 1,
};

interface ParsedToolCall {
  callId: string;
  name: string;
  args: Record<string, unknown>;
}

interface RunState {
  startedAt: number;
  toolCallCount: number;
  repairAttempts: number;
  parts: MessagePart[];
}

export class BoothAgent {
  private readonly toolsByName: Map<string, AgentTool>;

  constructor(
    private readonly textProvider: TextProvider,
    tools: AgentTool[],
  ) {
    this.toolsByName = new Map(tools.map((tool) => [tool.name, tool]));
  }

  async run(
    userMessage: string,
    history: AgentMessage[],
    context: AgentRunContext,
    opts: AgentRunOptions = DEFAULT_OPTIONS,
  ): Promise<AgentRunResult> {
    const options = normalizeOptions(opts);
    const state: RunState = {
      startedAt: Date.now(),
      toolCallCount: 0,
      repairAttempts: 0,
      parts: [],
    };
    const messages = trimHistory([
      ...history,
      { role: 'user', textContent: userMessage },
    ]);

    return this.runTurn(messages, context, options, state);
  }

  private async runTurn(
    messages: AgentMessage[],
    context: AgentRunContext,
    options: AgentRunOptions,
    state: RunState,
  ): Promise<AgentRunResult> {
    if (isTimedOut(state, options)) return interrupted(state, 'AGENT_TIMEOUT');

    const systemPrompt = buildSystemPrompt([...this.toolsByName.values()]);
    const fullPromptText = buildConversationPrompt(systemPrompt, messages);
    const promptSnapshot: PromptSnapshot = {
      templateId: 'booth_agent',
      version: '2026-09-16.1',
      templateText: systemPrompt,
      renderedText: fullPromptText,
      variables: {},
      snapshotAt: new Date().toISOString(),
    };
    const generated = await this.textProvider.generate({
      requestId: `${context.runId}:${state.toolCallCount}:${state.repairAttempts}`,
      promptSnapshot,
      variables: {},
    });
    if (isTimedOut(state, options)) return interrupted(state, 'AGENT_TIMEOUT');

    const parsed = parseToolCall(generated.text);
    if (parsed.kind === 'invalid') {
      if (state.repairAttempts >= options.maxRepairAttempts) {
        return failed(state, 'INVALID_TOOL_CALL', '工具调用格式无效。');
      }
      state.repairAttempts++;
      const repairedMessages = trimHistory([
        ...messages,
        { role: 'assistant', textContent: generated.text },
        {
          role: 'user',
          textContent:
            '你刚才的工具调用格式无效。若需要工具，只能在最后单独输出一行合法的 TOOL_CALL JSON；否则直接给出安全的 Markdown 回复。',
        },
      ]);
      return this.runTurn(repairedMessages, context, options, state);
    }

    if (parsed.kind === 'none') {
      const text = sanitizeMarkdown(generated.text);
      let offset = 0;
      for (const delta of text) {
        await context.onTextDelta(delta, offset);
        offset += delta.length;
      }
      if (text) state.parts.push({ type: 'text', text });
      return { status: 'completed', finalParts: state.parts };
    }

    if (
      state.toolCallCount >= options.maxToolCalls ||
      isTimedOut(state, options)
    ) {
      return interrupted(state, 'TOOL_CALL_LIMIT');
    }
    state.toolCallCount++;
    const toolPart: MessagePart = {
      type: 'tool',
      toolName: parsed.value.name,
      callId: parsed.value.callId,
      status: 'running',
      summary: '正在调用工具',
    };
    state.parts.push(toolPart);
    await context.onToolCallStart(parsed.value.callId, parsed.value.name);

    const tool = this.toolsByName.get(parsed.value.name);
    let toolResult: ToolResult;
    if (!tool) {
      const summary = '未授权的工具调用';
      toolPart.status = 'failed';
      toolPart.summary = summary;
      await context.onToolCallEnd(
        parsed.value.callId,
        parsed.value.name,
        'failed',
        summary,
      );
      toolResult = {
        callId: parsed.value.callId,
        toolName: parsed.value.name,
        status: 'failed',
        result: null,
        errorMessage: summary,
      };
    } else {
      try {
        const result = await tool.execute(parsed.value.args, context);
        const summary = summarizeToolResult(result);
        toolPart.status = 'succeeded';
        toolPart.summary = summary;
        await context.onToolCallEnd(
          parsed.value.callId,
          parsed.value.name,
          'succeeded',
          summary,
        );
        toolResult = {
          callId: parsed.value.callId,
          toolName: parsed.value.name,
          status: 'succeeded',
          result,
        };

        if (isProposalTool(parsed.value.name)) {
          const confirmationId = confirmationIdFrom(result);
          if (!confirmationId) {
            return failed(
              state,
              'CONFIRMATION_NOT_CREATED',
              '操作提案未能创建确认请求。',
            );
          }
          state.parts.push({ type: 'confirmation', confirmationId });
          return { status: 'awaiting_confirmation', finalParts: state.parts };
        }
      } catch (error) {
        const summary = '工具调用失败';
        toolPart.status = 'failed';
        toolPart.summary = summary;
        await context.onToolCallEnd(
          parsed.value.callId,
          parsed.value.name,
          'failed',
          summary,
        );
        toolResult = {
          callId: parsed.value.callId,
          toolName: parsed.value.name,
          status: 'failed',
          result: null,
          errorMessage: error instanceof Error ? error.message : summary,
        };
      }
    }

    if (isTimedOut(state, options)) return interrupted(state, 'AGENT_TIMEOUT');
    return this.runTurn(
      trimHistory([
        ...messages,
        {
          role: 'assistant',
          textContent: '',
          toolCalls: [{ name: parsed.value.name, args: parsed.value.args }],
        },
        {
          role: 'user',
          textContent: JSON.stringify({ toolResult }),
          toolResults: [toolResult],
        },
      ]),
      context,
      options,
      state,
    );
  }
}

function normalizeOptions(options: AgentRunOptions): AgentRunOptions {
  return {
    maxToolCalls:
      Number.isSafeInteger(options.maxToolCalls) && options.maxToolCalls > 0
        ? options.maxToolCalls
        : DEFAULT_OPTIONS.maxToolCalls,
    maxDurationMs:
      Number.isSafeInteger(options.maxDurationMs) && options.maxDurationMs > 0
        ? options.maxDurationMs
        : DEFAULT_OPTIONS.maxDurationMs,
    maxRepairAttempts:
      Number.isSafeInteger(options.maxRepairAttempts) &&
      options.maxRepairAttempts >= 0
        ? options.maxRepairAttempts
        : DEFAULT_OPTIONS.maxRepairAttempts,
  };
}

function buildSystemPrompt(tools: AgentTool[]): string {
  const toolDescriptions = tools
    .map(
      (tool) =>
        `- ${tool.name}: ${tool.description}\n  参数 JSON Schema: ${JSON.stringify(tool.parametersSchema)}`,
    )
    .join('\n');
  return `你是展览设计助手，帮助用户梳理展台设计 Brief、查看项目素材与历史效果图，并提出后续操作建议。

你只能使用下列已授权工具：
${toolDescriptions}

工具是受控的：只读工具仅用于查询；任何修改 Brief 或生成图片都必须使用 propose_ 工具创建用户确认，绝不能直接执行。
如需调用工具，在回复末尾单独输出一行，且只输出一个调用：
TOOL_CALL:{"name":"工具名","args":{},"callId":"唯一调用标识"}
不要使用其他工具调用格式。工具结果会在下一轮提供。

安全规则：不泄露隐藏推理过程；只给出结论、必要理由和可执行建议。使用安全 Markdown，绝不输出原始 HTML 标签。`;
}

function buildConversationPrompt(
  systemPrompt: string,
  messages: AgentMessage[],
): string {
  const lines = [systemPrompt, '', '对话：'];
  for (const message of messages) {
    lines.push(
      `${message.role === 'user' ? '用户' : '助手'}: ${message.textContent}`,
    );
    if (message.toolCalls?.length) {
      lines.push(`工具调用: ${JSON.stringify(message.toolCalls)}`);
    }
    if (message.toolResults?.length) {
      lines.push(`工具结果: ${JSON.stringify(message.toolResults)}`);
    }
  }
  lines.push('助手:');
  return lines.join('\n');
}

function trimHistory(history: AgentMessage[]): AgentMessage[] {
  const firstUser = history.find((message) => message.role === 'user');
  let kept = history.slice(-20);
  if (firstUser && !kept.includes(firstUser)) kept = [firstUser, ...kept];
  while (kept.length > 1 && messageCharacters(kept) > 30_000) {
    const removableIndex = kept[0] === firstUser ? 1 : 0;
    kept.splice(removableIndex, 1);
  }
  return kept;
}

function messageCharacters(messages: AgentMessage[]): number {
  return messages.reduce(
    (total, message) =>
      total +
      message.textContent.length +
      JSON.stringify(message.toolCalls ?? []).length +
      JSON.stringify(message.toolResults ?? []).length,
    0,
  );
}

function parseToolCall(
  text: string,
):
  | { kind: 'none' }
  | { kind: 'invalid' }
  | { kind: 'valid'; value: ParsedToolCall } {
  const line = text.match(/^TOOL_CALL:(.+)$/m);
  if (!line) return { kind: 'none' };
  try {
    const parsed: unknown = JSON.parse(line[1]!);
    if (
      !isRecord(parsed) ||
      typeof parsed.name !== 'string' ||
      typeof parsed.callId !== 'string' ||
      !isRecord(parsed.args)
    ) {
      return { kind: 'invalid' };
    }
    return {
      kind: 'valid',
      value: { name: parsed.name, callId: parsed.callId, args: parsed.args },
    };
  } catch {
    return { kind: 'invalid' };
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function sanitizeMarkdown(text: string): string {
  return text
    .replace(/^TOOL_CALL:.*$/gm, '')
    .replace(/<\/?[a-z][^>]*>/gi, '')
    .trim();
}

function summarizeToolResult(result: unknown): string {
  if (Array.isArray(result)) return `已获取 ${result.length} 条结果`;
  if (isRecord(result) && typeof result.message === 'string') {
    return sanitizeMarkdown(result.message).slice(0, 500);
  }
  return '工具调用完成';
}

function isProposalTool(name: string): boolean {
  return name === 'propose_brief_patch' || name === 'propose_generation';
}

function confirmationIdFrom(result: unknown): string | null {
  return isRecord(result) && typeof result.confirmationId === 'string'
    ? result.confirmationId
    : null;
}

function isTimedOut(state: RunState, options: AgentRunOptions): boolean {
  return Date.now() - state.startedAt >= options.maxDurationMs;
}

function interrupted(state: RunState, errorCode: string): AgentRunResult {
  state.parts.push({ type: 'execution_summary', summary: '运行已中断' });
  return { status: 'interrupted', errorCode, finalParts: state.parts };
}

function failed(
  state: RunState,
  errorCode: string,
  message: string,
): AgentRunResult {
  state.parts.push({ type: 'error', code: errorCode, message });
  return { status: 'failed', errorCode, finalParts: state.parts };
}
