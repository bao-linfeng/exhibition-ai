import { and, desc, eq, lt, sql } from 'drizzle-orm';
import type {
  AgentRun,
  Confirmation,
  Conversation,
  Database,
  Message,
} from '@exhibition/db';
import {
  agentRuns,
  confirmations,
  conversations,
  messages,
} from '@exhibition/db';

export class ConversationRepository {
  constructor(private db: Database) {}

  async findOrCreateByProjectId(projectId: string): Promise<Conversation> {
    const [created] = await this.db
      .insert(conversations)
      .values({ projectId })
      .onConflictDoNothing({ target: conversations.projectId })
      .returning();

    if (created) return created;

    const conversation = await this.findByProjectId(projectId);
    if (!conversation) throw new Error('Failed to find or create conversation');
    return conversation;
  }

  async findByProjectId(projectId: string): Promise<Conversation | null> {
    const [conversation] = await this.db
      .select()
      .from(conversations)
      .where(eq(conversations.projectId, projectId))
      .limit(1);

    return conversation ?? null;
  }

  async findById(id: string): Promise<Conversation | null> {
    const [conversation] = await this.db
      .select()
      .from(conversations)
      .where(eq(conversations.id, id))
      .limit(1);

    return conversation ?? null;
  }

  async setActiveRun(
    conversationId: string,
    runId: string | null,
  ): Promise<void> {
    await this.db
      .update(conversations)
      .set({ activeRunId: runId, updatedAt: new Date() })
      .where(eq(conversations.id, conversationId));
  }
}

export class MessageRepository {
  constructor(private db: Database) {}

  async create(input: {
    conversationId: string;
    runId?: string;
    role: string;
    parts: unknown[];
    status: string;
    clientMessageId?: string;
    createdBy?: string;
  }): Promise<Message> {
    const [message] = await this.db
      .insert(messages)
      .values({
        conversationId: input.conversationId,
        runId: input.runId ?? null,
        role: input.role,
        parts: input.parts,
        status: input.status,
        clientMessageId: input.clientMessageId ?? null,
        createdBy: input.createdBy ?? null,
      })
      .returning();

    if (!message) throw new Error('Failed to insert message');
    return message;
  }

  async findByClientMessageId(
    clientMessageId: string,
  ): Promise<Message | null> {
    const [message] = await this.db
      .select()
      .from(messages)
      .where(eq(messages.clientMessageId, clientMessageId))
      .limit(1);

    return message ?? null;
  }

  async findById(id: string): Promise<Message | null> {
    const [message] = await this.db
      .select()
      .from(messages)
      .where(eq(messages.id, id))
      .limit(1);

    return message ?? null;
  }

  async findByRunId(runId: string): Promise<Message | null> {
    const [message] = await this.db
      .select()
      .from(messages)
      .where(and(eq(messages.runId, runId), eq(messages.role, 'assistant')))
      .orderBy(desc(messages.createdAt))
      .limit(1);

    return message ?? null;
  }

  async updateStatus(id: string, status: string): Promise<void> {
    await this.db.update(messages).set({ status }).where(eq(messages.id, id));
  }

  async updateParts(id: string, parts: unknown[]): Promise<void> {
    await this.db.update(messages).set({ parts }).where(eq(messages.id, id));
  }

  async updateStreamOffset(id: string, offset: number): Promise<void> {
    await this.db
      .update(messages)
      .set({ streamOffset: offset })
      .where(eq(messages.id, id));
  }

  async list(
    conversationId: string,
    opts: { before?: string; limit?: number },
  ): Promise<{
    data: Message[];
    page: { nextCursor: string | null; hasMore: boolean };
  }> {
    const limit = Math.min(Math.max(opts.limit ?? 20, 1), 50);
    const cursor = opts.before ? await this.findById(opts.before) : null;

    if (opts.before && (!cursor || cursor.conversationId !== conversationId)) {
      return { data: [], page: { nextCursor: null, hasMore: false } };
    }

    const rows = await this.db
      .select()
      .from(messages)
      .where(
        and(
          eq(messages.conversationId, conversationId),
          cursor ? lt(messages.createdAt, cursor.createdAt) : undefined,
        ),
      )
      .orderBy(desc(messages.createdAt))
      .limit(limit + 1);

    const hasMore = rows.length > limit;
    const data = hasMore ? rows.slice(0, limit) : rows;
    const last = data.at(-1);

    return {
      data,
      page: {
        nextCursor: hasMore && last ? last.id : null,
        hasMore,
      },
    };
  }
}

export class AgentRunRepository {
  constructor(private db: Database) {}

  async create(input: {
    conversationId: string;
    projectId: string;
    taskId: string;
  }): Promise<AgentRun> {
    const [run] = await this.db.insert(agentRuns).values(input).returning();

    if (!run) throw new Error('Failed to insert agent run');
    return run;
  }

  async findById(id: string): Promise<AgentRun | null> {
    const [run] = await this.db
      .select()
      .from(agentRuns)
      .where(eq(agentRuns.id, id))
      .limit(1);

    return run ?? null;
  }

  async findActiveByConversationId(
    conversationId: string,
  ): Promise<AgentRun | null> {
    const [run] = await this.db
      .select()
      .from(agentRuns)
      .where(
        and(
          eq(agentRuns.conversationId, conversationId),
          sql`${agentRuns.status} IN ('pending', 'running', 'awaiting_confirmation')`,
        ),
      )
      .orderBy(desc(agentRuns.createdAt))
      .limit(1);

    return run ?? null;
  }

  async findLatestByConversationId(
    conversationId: string,
  ): Promise<AgentRun | null> {
    const [run] = await this.db
      .select()
      .from(agentRuns)
      .where(eq(agentRuns.conversationId, conversationId))
      .orderBy(desc(agentRuns.createdAt))
      .limit(1);

    return run ?? null;
  }

  async updateStatus(
    id: string,
    status: string,
    extra?: {
      startedAt?: Date | null;
      finishedAt?: Date | null;
      errorCode?: string | null;
      toolCallCount?: number;
    },
  ): Promise<void> {
    await this.db
      .update(agentRuns)
      .set({
        status,
        ...(extra?.startedAt !== undefined
          ? { startedAt: extra.startedAt }
          : {}),
        ...(extra?.finishedAt !== undefined
          ? { finishedAt: extra.finishedAt }
          : {}),
        ...(extra?.errorCode !== undefined
          ? { errorCode: extra.errorCode }
          : {}),
        ...(extra?.toolCallCount !== undefined
          ? { toolCallCount: extra.toolCallCount }
          : {}),
      })
      .where(eq(agentRuns.id, id));
  }

  async incrementToolCallCount(id: string): Promise<number> {
    const [run] = await this.db
      .update(agentRuns)
      .set({ toolCallCount: sql`${agentRuns.toolCallCount} + 1` })
      .where(eq(agentRuns.id, id))
      .returning({ toolCallCount: agentRuns.toolCallCount });

    if (!run) throw new Error('Agent run not found');
    return run.toolCallCount;
  }
}

export class ConfirmationRepository {
  constructor(private db: Database) {}

  async create(input: {
    runId: string;
    projectId: string;
    requestedBy: string;
    action: string;
    payload: Record<string, unknown>;
    payloadHash: string;
    estimatedFeeMinor?: number;
    currency?: string;
    expiresAt: Date;
  }): Promise<Confirmation> {
    const [confirmation] = await this.db
      .insert(confirmations)
      .values({
        ...input,
        estimatedFeeMinor: input.estimatedFeeMinor ?? null,
        currency: input.currency ?? null,
      })
      .returning();

    if (!confirmation) throw new Error('Failed to insert confirmation');
    return confirmation;
  }

  async findById(id: string): Promise<Confirmation | null> {
    const [confirmation] = await this.db
      .select()
      .from(confirmations)
      .where(eq(confirmations.id, id))
      .limit(1);

    return confirmation ?? null;
  }

  async findPendingByRunId(runId: string): Promise<Confirmation | null> {
    const [confirmation] = await this.db
      .select()
      .from(confirmations)
      .where(
        and(
          eq(confirmations.runId, runId),
          eq(confirmations.status, 'pending'),
        ),
      )
      .orderBy(desc(confirmations.createdAt))
      .limit(1);

    return confirmation ?? null;
  }

  async tryClaimPending(id: string): Promise<boolean> {
    const rows = await this.db
      .update(confirmations)
      .set({ status: 'processing' })
      .where(and(eq(confirmations.id, id), eq(confirmations.status, 'pending')))
      .returning({ id: confirmations.id });
    return rows.length > 0;
  }

  async updateStatus(
    id: string,
    status: string,
    extra?: {
      resultTaskId?: string | null;
      resultBriefRevisionId?: string | null;
    },
  ): Promise<void> {
    await this.db
      .update(confirmations)
      .set({
        status,
        ...(extra?.resultTaskId !== undefined
          ? { resultTaskId: extra.resultTaskId }
          : {}),
        ...(extra?.resultBriefRevisionId !== undefined
          ? { resultBriefRevisionId: extra.resultBriefRevisionId }
          : {}),
      })
      .where(eq(confirmations.id, id));
  }

  async findExpiredPendingIds(): Promise<string[]> {
    const rows = await this.db
      .select({ id: confirmations.id })
      .from(confirmations)
      .where(
        and(
          eq(confirmations.status, 'pending'),
          lt(confirmations.expiresAt, new Date()),
        ),
      )
      .limit(100);

    return rows.map((row) => row.id);
  }
}
