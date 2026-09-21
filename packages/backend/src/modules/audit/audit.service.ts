import { and, desc, eq, gte, lte, sql } from 'drizzle-orm';
import type { ListAuditLogsQuery } from '@exhibition/contracts';
import {
  auditLogs,
  type AuditLog,
  type Database,
  type NewAuditLog,
} from '@exhibition/db';

// AuditService 只追加，不提供更新或删除方法
export class AuditService {
  constructor(private readonly db: Database) {}

  async log(entry: Omit<NewAuditLog, 'id' | 'createdAt'>): Promise<void> {
    await this.db.insert(auditLogs).values({
      ...entry,
      metadata: entry.metadata ?? {},
    });
  }

  async findAll(query: ListAuditLogsQuery): Promise<{
    data: AuditLog[];
    page: { nextCursor: string | null; hasMore: boolean };
  }> {
    const limit = Math.min(Math.max(query.limit ?? 20, 1), 100);

    const conditions = [
      query.eventType ? eq(auditLogs.eventType, query.eventType) : undefined,
      query.actorId ? eq(auditLogs.actorId, query.actorId) : undefined,
      query.projectId ? eq(auditLogs.projectId, query.projectId) : undefined,
      query.resourceType
        ? eq(auditLogs.resourceType, query.resourceType)
        : undefined,
      query.startDate
        ? gte(auditLogs.createdAt, new Date(query.startDate))
        : undefined,
      query.endDate
        ? lte(auditLogs.createdAt, new Date(query.endDate))
        : undefined,
    ].filter(Boolean);

    if (query.cursor) {
      const { createdAt, id } = JSON.parse(
        Buffer.from(query.cursor, 'base64url').toString(),
      ) as { createdAt: string; id: string };
      conditions.push(
        sql`(${auditLogs.createdAt} < ${new Date(createdAt)} OR (${auditLogs.createdAt} = ${new Date(createdAt)} AND ${auditLogs.id} < ${id}))`,
      );
    }

    const rows = await this.db
      .select()
      .from(auditLogs)
      .where(and(...(conditions as Parameters<typeof and>)))
      .orderBy(desc(auditLogs.createdAt), desc(auditLogs.id))
      .limit(limit + 1);

    const hasMore = rows.length > limit;
    const data = hasMore ? rows.slice(0, limit) : rows;
    const last = data.at(-1);
    const nextCursor =
      hasMore && last
        ? Buffer.from(
            JSON.stringify({
              createdAt: last.createdAt.toISOString(),
              id: last.id,
            }),
          ).toString('base64url')
        : null;

    return { data, page: { hasMore, nextCursor } };
  }
}
