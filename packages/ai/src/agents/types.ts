export interface ToolInput {
  name: string;
  args: Record<string, unknown>;
}

export interface ToolResult {
  callId: string;
  toolName: string;
  status: 'succeeded' | 'failed';
  result: unknown;
  errorMessage?: string;
}

export interface AgentMessage {
  role: 'user' | 'assistant';
  textContent: string;
  toolCalls?: ToolInput[];
  toolResults?: ToolResult[];
}

export interface AgentTool {
  name: string;
  description: string;
  parametersSchema: Record<string, unknown>;
  execute(
    args: Record<string, unknown>,
    context: AgentRunContext,
  ): Promise<unknown>;
}

export interface AgentRunContext {
  projectId: string;
  conversationId: string;
  runId: string;
  requestedBy: string;
  getBrief(): Promise<unknown>;
  listAssets(): Promise<unknown[]>;
  listVersions(): Promise<unknown[]>;
  createConfirmation(input: {
    action: 'apply_brief_patch' | 'create_generation';
    payload: Record<string, unknown>;
    payloadHash: string;
    estimatedFeeMinor?: number;
    currency?: string;
  }): Promise<{ confirmationId: string }>;
  onTextDelta(delta: string, offset: number): Promise<void>;
  onToolCallStart(callId: string, toolName: string): Promise<void>;
  onToolCallEnd(
    callId: string,
    toolName: string,
    status: 'succeeded' | 'failed',
    summary: string,
  ): Promise<void>;
  onConfirmationCreated(
    confirmationId: string,
    question: string,
  ): Promise<void>;
}

export interface AgentRunOptions {
  maxToolCalls: number;
  maxDurationMs: number;
  maxRepairAttempts: number;
}

export interface AgentRunResult {
  status: 'completed' | 'interrupted' | 'awaiting_confirmation' | 'failed';
  errorCode?: string;
  finalParts: MessagePart[];
}

export type MessagePart =
  | { type: 'text'; text: string }
  | { type: 'execution_summary'; summary: string }
  | {
      type: 'tool';
      toolName: string;
      callId: string;
      status: 'running' | 'succeeded' | 'failed';
      summary: string;
    }
  | { type: 'asset'; assetId: string }
  | { type: 'task'; taskId: string }
  | { type: 'confirmation'; confirmationId: string }
  | { type: 'error'; code: string; message: string };
