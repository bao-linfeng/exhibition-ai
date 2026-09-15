import { eq, sql } from 'drizzle-orm';
import {
  type Database,
  quotaAccounts,
  type QuotaAccount,
  type NewUsageLedger,
  usageLedger,
} from '@exhibition/db';

type DatabaseTransaction = Parameters<
  Parameters<Database['transaction']>[0]
>[0];

export class QuotaRepository {
  constructor(private readonly db: Database) {}

  async findSystemAccount(): Promise<QuotaAccount | undefined> {
    const rows = await this.db
      .select()
      .from(quotaAccounts)
      .where(eq(quotaAccounts.ownerType, 'system'))
      .limit(1);
    return rows[0];
  }

  async findUserAccount(userId: string): Promise<QuotaAccount | undefined> {
    const rows = await this.db
      .select()
      .from(quotaAccounts)
      .where(eq(quotaAccounts.ownerId, userId))
      .limit(1);
    return rows[0];
  }

  async findOrCreateSystemAccount(currency: string): Promise<QuotaAccount> {
    const existing = await this.findSystemAccount();
    if (existing) return existing;
    const rows = await this.db
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
    return (await this.findSystemAccount())!;
  }

  async findOrCreateUserAccount(
    userId: string,
    currency: string,
  ): Promise<QuotaAccount> {
    const existing = await this.findUserAccount(userId);
    if (existing) return existing;
    const rows = await this.db
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
    return (await this.findUserAccount(userId))!;
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
