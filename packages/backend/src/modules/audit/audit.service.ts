import { auditLogs, type Database, type NewAuditLog } from '@exhibition/db';

// AuditService 只追加，不提供更新或删除方法
export class AuditService {
  constructor(private readonly db: Database) {}

  async log(entry: Omit<NewAuditLog, 'id' | 'createdAt'>): Promise<void> {
    await this.db.insert(auditLogs).values({
      ...entry,
      metadata: entry.metadata ?? {},
    });
  }
}
