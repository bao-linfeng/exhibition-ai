import { and, eq, isNull, sql } from 'drizzle-orm';
import {
  type Database,
  quotaAccounts,
  type QuotaAccount,
  type NewUsageLedger,
  usageLedger,
} from '@exhibition/db';

export type DatabaseTransaction = Parameters<
  Parameters<Database['transaction']>[0]
>[0];

export class QuotaRepository {
  constructor(private readonly db: Database) {}

  async findSystemAccount(currency: string): Promise<QuotaAccount | undefined> {
    return this.findSystemAccountIn(this.db, currency);
  }

  async findSystemAccountIn(
    db: Database | DatabaseTransaction,
    currency: string,
  ): Promise<QuotaAccount | undefined> {
    const rows = await db
      .select()
      .from(quotaAccounts)
      .where(
        and(
          eq(quotaAccounts.ownerType, 'system'),
          isNull(quotaAccounts.ownerId),
          eq(quotaAccounts.currency, currency),
        ),
      )
      .limit(1);
    return rows[0];
  }

  async findUserAccount(
    userId: string,
    currency: string,
  ): Promise<QuotaAccount | undefined> {
    return this.findUserAccountIn(this.db, userId, currency);
  }

  private async findUserAccountIn(
    db: Database | DatabaseTransaction,
    userId: string,
    currency: string,
  ): Promise<QuotaAccount | undefined> {
    const rows = await db
      .select()
      .from(quotaAccounts)
      .where(
        and(
          eq(quotaAccounts.ownerType, 'user'),
          eq(quotaAccounts.ownerId, userId),
          eq(quotaAccounts.currency, currency),
        ),
      )
      .limit(1);
    return rows[0];
  }

  async findOrCreateSystemAccount(currency: string): Promise<QuotaAccount> {
    return this.findOrCreateSystemAccountInConnection(this.db, currency);
  }

  async findOrCreateSystemAccountIn(
    tx: DatabaseTransaction,
    currency: string,
  ): Promise<QuotaAccount> {
    return this.findOrCreateSystemAccountInConnection(tx, currency);
  }

  private async findOrCreateSystemAccountInConnection(
    db: Database | DatabaseTransaction,
    currency: string,
  ): Promise<QuotaAccount> {
    const existing = await this.findSystemAccountIn(db, currency);
    if (existing) return existing;
    const rows = await db
      .insert(quotaAccounts)
      .values({
        ownerType: 'system',
        ownerId: null,
        balanceMinor: 0,
        reservedMinor: 0,
        currency,
      })
      .onConflictDoNothing()
      .returning();
    if (rows[0]) return rows[0];
    return (await this.findSystemAccountIn(db, currency))!;
  }

  async findOrCreateUserAccount(
    userId: string,
    currency: string,
  ): Promise<QuotaAccount> {
    return this.findOrCreateUserAccountInConnection(this.db, userId, currency);
  }

  private async findOrCreateUserAccountInConnection(
    db: Database | DatabaseTransaction,
    userId: string,
    currency: string,
  ): Promise<QuotaAccount> {
    const existing = await this.findUserAccountIn(db, userId, currency);
    if (existing) return existing;
    const rows = await db
      .insert(quotaAccounts)
      .values({
        ownerType: 'user',
        ownerId: userId,
        balanceMinor: 0,
        reservedMinor: 0,
        currency,
      })
      .onConflictDoNothing()
      .returning();
    if (rows[0]) return rows[0];
    return (await this.findUserAccountIn(db, userId, currency))!;
  }

  async atomicReserve(
    tx: DatabaseTransaction,
    accountId: string,
    amountMinor: number,
  ): Promise<{ ok: boolean; account: QuotaAccount }> {
    const rows = await tx
      .update(quotaAccounts)
      .set({
        reservedMinor: sql`${quotaAccounts.reservedMinor} + ${amountMinor}`,
        updatedAt: new Date(),
      })
      .where(
        sql`${quotaAccounts.id} = ${accountId} AND (${quotaAccounts.balanceMinor} - ${quotaAccounts.reservedMinor}) >= ${amountMinor}`,
      )
      .returning();
    if (rows[0]) return { ok: true, account: rows[0] };
    const current = await tx
      .select()
      .from(quotaAccounts)
      .where(eq(quotaAccounts.id, accountId))
      .limit(1);
    return { ok: false, account: current[0]! };
  }

  async atomicSettle(
    tx: DatabaseTransaction,
    accountId: string,
    reservedAmount: number,
    actualAmount: number,
  ): Promise<QuotaAccount> {
    const rows = await tx
      .update(quotaAccounts)
      .set({
        balanceMinor: sql`${quotaAccounts.balanceMinor} - ${actualAmount}`,
        reservedMinor: sql`${quotaAccounts.reservedMinor} - ${reservedAmount}`,
        updatedAt: new Date(),
      })
      .where(eq(quotaAccounts.id, accountId))
      .returning();
    return rows[0]!;
  }

  async atomicRelease(
    tx: DatabaseTransaction,
    accountId: string,
    reservedAmount: number,
  ): Promise<QuotaAccount> {
    const rows = await tx
      .update(quotaAccounts)
      .set({
        reservedMinor: sql`${quotaAccounts.reservedMinor} - ${reservedAmount}`,
        updatedAt: new Date(),
      })
      .where(eq(quotaAccounts.id, accountId))
      .returning();
    return rows[0]!;
  }

  async topup(accountId: string, amountMinor: number): Promise<QuotaAccount> {
    const rows = await this.db
      .update(quotaAccounts)
      .set({
        balanceMinor: sql`${quotaAccounts.balanceMinor} + ${amountMinor}`,
        updatedAt: new Date(),
      })
      .where(eq(quotaAccounts.id, accountId))
      .returning();
    return rows[0]!;
  }

  async insertLedgerEntry(
    tx: DatabaseTransaction,
    entry: Omit<NewUsageLedger, 'id' | 'createdAt'>,
  ): Promise<void> {
    await tx.insert(usageLedger).values(entry);
  }

  async insertLedgerEntryNoTx(
    entry: Omit<NewUsageLedger, 'id' | 'createdAt'>,
  ): Promise<void> {
    await this.db.insert(usageLedger).values(entry);
  }
}
