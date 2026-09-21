import { and, count, desc, eq, ilike, lt, or, sql } from 'drizzle-orm';
import type { Database, User } from '@exhibition/db';
import { users } from '@exhibition/db';

type TxDb = Parameters<Parameters<Database['transaction']>[0]>[0];

export interface UserListOptions {
  role?: User['role'];
  status?: User['status'];
  search?: string;
  cursor?: string;
  limit?: number;
}

export class UserRepository {
  constructor(private db: Database) {}

  async findAll(options: UserListOptions): Promise<{
    data: User[];
    page: { nextCursor: string | null; hasMore: boolean };
  }> {
    const limit = Math.min(Math.max(options.limit ?? 20, 1), 100);

    const conditions = [
      options.role ? eq(users.role, options.role) : undefined,
      options.status ? eq(users.status, options.status) : undefined,
      options.search
        ? or(
            ilike(users.displayName, `%${options.search}%`),
            ilike(users.email, `%${options.search}%`),
          )
        : undefined,
    ].filter(Boolean);

    if (options.cursor) {
      const { createdAt, id } = JSON.parse(
        Buffer.from(options.cursor, 'base64url').toString(),
      ) as { createdAt: string; id: string };
      conditions.push(
        or(
          lt(users.createdAt, new Date(createdAt)),
          and(eq(users.createdAt, new Date(createdAt)), lt(users.id, id)),
        )!,
      );
    }

    const rows = await this.db
      .select()
      .from(users)
      .where(and(...(conditions as Parameters<typeof and>)))
      .orderBy(desc(users.createdAt), desc(users.id))
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

  async findById(id: string): Promise<User | undefined> {
    const [user] = await this.db
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1);
    return user;
  }

  async update(
    id: string,
    data: Partial<Pick<User, 'role' | 'status'>>,
    expectedRevision: number,
  ): Promise<User | null | 'conflict'> {
    const [user] = await this.db
      .update(users)
      .set({
        ...data,
        updatedAt: new Date(),
        revision: sql`${users.revision} + 1`,
      })
      .where(and(eq(users.id, id), eq(users.revision, expectedRevision)))
      .returning();
    if (user) return user;
    return (await this.findById(id)) ? 'conflict' : null;
  }

  async countActiveAdmins(): Promise<number> {
    const [row] = await this.db
      .select({ cnt: count() })
      .from(users)
      .where(and(eq(users.role, 'admin'), eq(users.status, 'enabled')));
    return row?.cnt ?? 0;
  }

  /**
   * 在同一事务内，用行锁原子地检查最后管理员保护条件并执行更新。
   * 先以 FOR UPDATE 锁定目标行，再统计活跃管理员数量，若仍有剩余则更新。
   * 返回 'last_admin' 表示拒绝（降权/禁用后系统将无可用管理员）。
   */
  async updateWithLastAdminGuard(
    id: string,
    data: Partial<Pick<User, 'role' | 'status'>>,
    expectedRevision: number,
  ): Promise<User | null | 'conflict' | 'last_admin'> {
    return this.db.transaction(async (tx: TxDb) => {
      // 锁定目标行，防止并发竞态（FOR UPDATE 悲观锁）
      const [target] = await tx
        .select()
        .from(users)
        .where(eq(users.id, id))
        .for('update')
        .limit(1);
      if (!target) return null;

      // 判断此次变更是否会移除管理员身份或禁用管理员
      const wouldLoseAdmin =
        (data.role !== undefined &&
          data.role !== 'admin' &&
          target.role === 'admin') ||
        (data.status === 'disabled' &&
          target.role === 'admin' &&
          target.status === 'enabled');

      if (wouldLoseAdmin) {
        const [row] = await tx
          .select({ cnt: count() })
          .from(users)
          .where(and(eq(users.role, 'admin'), eq(users.status, 'enabled')));
        const activeAdmins = row?.cnt ?? 0;
        if (activeAdmins <= 1) return 'last_admin';
      }

      // 乐观锁更新
      const [updated] = await tx
        .update(users)
        .set({
          ...data,
          updatedAt: new Date(),
          revision: sql`${users.revision} + 1`,
        })
        .where(and(eq(users.id, id), eq(users.revision, expectedRevision)))
        .returning();

      if (updated) return updated;
      // revision 不匹配 → 并发冲突
      return 'conflict';
    });
  }

  async findOptions(
    search?: string,
    limit = 20,
  ): Promise<Array<Pick<User, 'id' | 'displayName' | 'email' | 'role'>>> {
    return this.db
      .select({
        id: users.id,
        displayName: users.displayName,
        email: users.email,
        role: users.role,
      })
      .from(users)
      .where(
        and(
          eq(users.status, 'enabled'),
          search
            ? or(
                ilike(users.displayName, `%${search}%`),
                ilike(users.email, `%${search}%`),
              )
            : undefined,
        ),
      )
      .orderBy(users.displayName)
      .limit(Math.min(Math.max(limit, 1), 50));
  }
}
