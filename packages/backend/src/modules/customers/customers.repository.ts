import { and, desc, eq, ilike, inArray, lt, or, sql } from 'drizzle-orm';
import type { Customer, Database, NewCustomer } from '@exhibition/db';
import { customers, projectMembers, projects } from '@exhibition/db';

export interface CustomerListOptions {
  status?: Customer['status'];
  search?: string;
  cursor?: string;
  limit?: number;
  userId: string;
  userRole: string;
}

export class CustomerRepository {
  constructor(private db: Database) {}

  async findAll(options: CustomerListOptions): Promise<{
    data: Customer[];
    page: { nextCursor: string | null; hasMore: boolean };
  }> {
    const limit = Math.min(Math.max(options.limit ?? 20, 1), 100);

    // For non-admin users, apply scope filtering:
    // - Can see customers they created
    // - Can see customers linked to projects they're members of
    let scopeFilter = undefined;
    if (
      options.userRole === 'designer' ||
      options.userRole === 'viewer' ||
      options.userRole === 'sales'
    ) {
      const visibleCustomerIdsSubquery = this.db
        .select({ customerId: projects.customerId })
        .from(projects)
        .innerJoin(projectMembers, eq(projects.id, projectMembers.projectId))
        .where(eq(projectMembers.userId, options.userId));

      scopeFilter = or(
        eq(customers.createdBy, options.userId),
        inArray(customers.id, visibleCustomerIdsSubquery),
      );
    }

    const conditions = [
      options.status ? eq(customers.status, options.status) : undefined,
      options.search ? ilike(customers.name, `%${options.search}%`) : undefined,
      scopeFilter,
    ].filter(Boolean);

    if (options.cursor) {
      const { createdAt, id } = JSON.parse(
        Buffer.from(options.cursor, 'base64url').toString(),
      ) as { createdAt: string; id: string };
      conditions.push(
        or(
          lt(customers.createdAt, new Date(createdAt)),
          and(
            eq(customers.createdAt, new Date(createdAt)),
            lt(customers.id, id),
          ),
        )!,
      );
    }

    const rows = await this.db
      .select()
      .from(customers)
      .where(and(...(conditions as Parameters<typeof and>)))
      .orderBy(desc(customers.createdAt), desc(customers.id))
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

    return { data, page: { nextCursor, hasMore } };
  }

  async findById(
    id: string,
    userId: string,
    userRole: string,
  ): Promise<Customer | undefined> {
    // For non-admin users, apply scope filtering:
    // - Can see customers they created
    // - Can see customers linked to projects they're members of
    let scopeFilter = undefined;
    if (
      userRole === 'designer' ||
      userRole === 'viewer' ||
      userRole === 'sales'
    ) {
      const visibleCustomerIdsSubquery = this.db
        .select({ customerId: projects.customerId })
        .from(projects)
        .innerJoin(projectMembers, eq(projects.id, projectMembers.projectId))
        .where(eq(projectMembers.userId, userId));

      scopeFilter = or(
        eq(customers.createdBy, userId),
        inArray(customers.id, visibleCustomerIdsSubquery),
      );
    }

    const [customer] = await this.db
      .select()
      .from(customers)
      .where(and(eq(customers.id, id), scopeFilter))
      .limit(1);
    return customer;
  }

  async create(data: NewCustomer): Promise<Customer> {
    const [customer] = await this.db.insert(customers).values(data).returning();
    if (!customer) throw new Error('Customer creation did not return a row');
    return customer;
  }

  async update(
    id: string,
    data: Partial<
      Omit<
        NewCustomer,
        'id' | 'createdBy' | 'createdAt' | 'updatedAt' | 'revision'
      >
    >,
    expectedRevision: number,
  ): Promise<Customer | null> {
    const [customer] = await this.db
      .update(customers)
      .set({
        ...data,
        updatedAt: new Date(),
        revision: sql`${customers.revision} + 1`,
      })
      .where(
        and(eq(customers.id, id), eq(customers.revision, expectedRevision)),
      )
      .returning();
    return customer ?? null;
  }
}
