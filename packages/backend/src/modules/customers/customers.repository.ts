import { and, desc, eq, ilike, lt, sql } from 'drizzle-orm';
import type { Customer, Database, NewCustomer } from '@exhibition/db';
import { customers } from '@exhibition/db';

export interface CustomerListOptions {
  status?: Customer['status'];
  search?: string;
  cursor?: string;
  limit?: number;
}

export class CustomerRepository {
  constructor(private db: Database) {}

  async findAll(options: CustomerListOptions): Promise<{
    data: Customer[];
    page: { nextCursor: string | null; hasMore: boolean };
  }> {
    const limit = Math.min(Math.max(options.limit ?? 20, 1), 100);
    const rows = await this.db
      .select()
      .from(customers)
      .where(
        and(
          options.status ? eq(customers.status, options.status) : undefined,
          options.search
            ? ilike(customers.name, `%${options.search}%`)
            : undefined,
          options.cursor
            ? lt(customers.createdAt, new Date(options.cursor))
            : undefined,
        ),
      )
      .orderBy(desc(customers.createdAt))
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

  async findById(id: string): Promise<Customer | undefined> {
    const [customer] = await this.db
      .select()
      .from(customers)
      .where(eq(customers.id, id))
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
