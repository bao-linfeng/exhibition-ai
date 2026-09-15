import { and, desc, eq, ilike, lt, or, sql } from 'drizzle-orm';
import type { Database, User } from '@exhibition/db';
import { users } from '@exhibition/db';

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
    const rows = await this.db
      .select()
      .from(users)
      .where(
        and(
          options.role ? eq(users.role, options.role) : undefined,
          options.status ? eq(users.status, options.status) : undefined,
          options.search
            ? or(
                ilike(users.displayName, `%${options.search}%`),
                ilike(users.email, `%${options.search}%`),
              )
            : undefined,
          options.cursor
            ? lt(users.createdAt, new Date(options.cursor))
            : undefined,
        ),
      )
      .orderBy(desc(users.createdAt))
      .limit(limit + 1);
    const hasMore = rows.length > limit;
    const data = hasMore ? rows.slice(0, limit) : rows;
    const last = data.at(-1);
    return {
      data,
      page: {
        hasMore,
        nextCursor: hasMore && last ? last.createdAt.toISOString() : null,
      },
    };
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
