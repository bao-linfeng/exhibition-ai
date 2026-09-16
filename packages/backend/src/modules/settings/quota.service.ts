import { and, eq, sql } from 'drizzle-orm';
import {
  type Database,
  type QuotaAccount,
  quotaAccounts,
  tasks,
  usageLedger,
} from '@exhibition/db';
import type { AuditService } from '../audit/audit.service.js';
import type {
  DatabaseTransaction,
  QuotaRepository,
} from './quota.repository.js';
import { quotaPeriodDate } from './quota-period.js';

export interface ReserveResult {
  ok: boolean;
  ledgerEntryId?: string;
  accountId: string;
  availableMinor: number;
}

export interface SettleInput {
  taskId: string;
  actualAmountMinor: number;
  providerUsage?: Record<string, unknown> | null;
}

export type SettleResult =
  | { ok: true }
  | {
      ok: false;
      reason:
        | 'no_reserve'
        | 'already_settled'
        | 'amount_mismatch'
        | 'insufficient_reserved';
    };

export class QuotaService {
  constructor(
    private readonly db: Database,
    private readonly quotaRepo: QuotaRepository,
    private readonly auditService: AuditService,
  ) {}

  private toDto(account: QuotaAccount) {
    return {
      id: account.id,
      ownerType: account.ownerType as 'system' | 'user',
      ownerId: account.ownerId ?? null,
      balanceMinor: account.balanceMinor,
      reservedMinor: account.reservedMinor,
      availableMinor: Math.max(0, account.balanceMinor - account.reservedMinor),
      currency: account.currency,
    };
  }

  async getSystemQuota() {
    const account = await this.quotaRepo.findOrCreateSystemAccount('CNY');
    return this.toDto(account);
  }

  async getUserQuota(userId: string) {
    const account = await this.quotaRepo.findOrCreateUserAccount(userId, 'CNY');
    return this.toDto(account);
  }

  async reserveForTask(input: {
    taskId: string;
    estimatedAmountMinor: number;
    currency: string;
    provider: string;
    model: string;
    requestedBy: string;
  }): Promise<ReserveResult> {
    const systemAccount = await this.quotaRepo.findOrCreateSystemAccount(
      input.currency,
    );
    let result: ReserveResult | undefined;

    await this.db.transaction(async (tx) => {
      const { ok, account } = await this.quotaRepo.atomicReserve(
        tx,
        systemAccount.id,
        input.estimatedAmountMinor,
      );
      if (!ok) {
        result = {
          ok: false,
          accountId: systemAccount.id,
          availableMinor: Math.max(
            0,
            account.balanceMinor - account.reservedMinor,
          ),
        };
        return;
      }

      const today = quotaPeriodDate();
      await this.quotaRepo.insertLedgerEntry(tx, {
        taskId: input.taskId,
        attemptOrdinal: null,
        accountId: account.id,
        entryType: 'reserve',
        feeStatus: 'estimated',
        amountMinor: input.estimatedAmountMinor,
        currency: input.currency,
        provider: input.provider,
        model: input.model,
        providerUsage: null,
        periodDate: today,
      });

      result = {
        ok: true,
        accountId: account.id,
        availableMinor: Math.max(
          0,
          account.balanceMinor - account.reservedMinor,
        ),
      };
    });

    return result!;
  }

  async settleTask(input: SettleInput): Promise<SettleResult> {
    let result: SettleResult | undefined;
    await this.db.transaction(async (tx) => {
      const reserve = await this.lockReserve(tx, input.taskId);
      if (!reserve) {
        result = { ok: false, reason: 'no_reserve' };
        return;
      }
      if (await this.hasFinalOrUnknown(tx, input.taskId)) {
        result = { ok: false, reason: 'already_settled' };
        return;
      }
      if (
        !Number.isSafeInteger(input.actualAmountMinor) ||
        input.actualAmountMinor < 0 ||
        input.actualAmountMinor !== reserve.amountMinor
      ) {
        result = { ok: false, reason: 'amount_mismatch' };
        return;
      }

      await this.lockAccount(tx, reserve.accountId);
      const [account] = await tx
        .update(quotaAccounts)
        .set({
          balanceMinor: sql`${quotaAccounts.balanceMinor} - ${input.actualAmountMinor}`,
          reservedMinor: sql`${quotaAccounts.reservedMinor} - ${reserve.amountMinor}`,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(quotaAccounts.id, reserve.accountId),
            sql`${quotaAccounts.reservedMinor} >= ${reserve.amountMinor}`,
          ),
        )
        .returning({ id: quotaAccounts.id });
      if (!account) {
        result = { ok: false, reason: 'insufficient_reserved' };
        return;
      }

      await this.quotaRepo.insertLedgerEntry(tx, {
        taskId: input.taskId,
        attemptOrdinal: null,
        accountId: reserve.accountId,
        entryType: 'settle_actual',
        feeStatus: 'actual',
        amountMinor: input.actualAmountMinor,
        currency: reserve.currency,
        provider: reserve.provider,
        model: reserve.model,
        providerUsage: jsonSafe(input.providerUsage),
        periodDate: reserve.periodDate,
      });
      await tx
        .update(tasks)
        .set({
          fee: {
            status: 'actual',
            amountMinor: input.actualAmountMinor,
            currency: reserve.currency,
            provider: reserve.provider ?? '',
            model: reserve.model ?? '',
          },
        })
        .where(eq(tasks.id, input.taskId));
      result = { ok: true };
    });
    return result!;
  }

  async releaseReservation(input: { taskId: string }): Promise<void> {
    await this.db.transaction(async (tx) => {
      const reserve = await this.lockReserve(tx, input.taskId);
      if (!reserve || (await this.hasFinalOrUnknown(tx, input.taskId))) return;
      await this.lockAccount(tx, reserve.accountId);
      const [account] = await tx
        .update(quotaAccounts)
        .set({
          reservedMinor: sql`${quotaAccounts.reservedMinor} - ${reserve.amountMinor}`,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(quotaAccounts.id, reserve.accountId),
            sql`${quotaAccounts.reservedMinor} >= ${reserve.amountMinor}`,
          ),
        )
        .returning({ id: quotaAccounts.id });
      if (!account) throw new Error('Quota reservation is no longer available');
      await this.quotaRepo.insertLedgerEntry(tx, {
        taskId: input.taskId,
        attemptOrdinal: null,
        accountId: reserve.accountId,
        entryType: 'release',
        feeStatus: 'actual',
        amountMinor: 0,
        currency: reserve.currency,
        provider: reserve.provider,
        model: reserve.model,
        providerUsage: null,
        periodDate: reserve.periodDate,
      });
      await tx
        .update(tasks)
        .set({
          fee: {
            status: 'actual',
            amountMinor: 0,
            currency: reserve.currency,
            provider: reserve.provider ?? '',
            model: reserve.model ?? '',
          },
        })
        .where(eq(tasks.id, input.taskId));
    });
  }

  async markUnknown(input: {
    taskId: string;
    providerUsage?: Record<string, unknown> | null;
  }): Promise<void> {
    await this.db.transaction(async (tx) => {
      const reserve = await this.lockReserve(tx, input.taskId);
      if (!reserve || (await this.hasFinalOrUnknown(tx, input.taskId))) return;
      await this.lockAccount(tx, reserve.accountId);
      await this.quotaRepo.insertLedgerEntry(tx, {
        taskId: input.taskId,
        attemptOrdinal: null,
        accountId: reserve.accountId,
        entryType: 'settle_unknown',
        feeStatus: 'unknown',
        amountMinor: reserve.amountMinor,
        currency: reserve.currency,
        provider: reserve.provider,
        model: reserve.model,
        providerUsage: jsonSafe(input.providerUsage),
        periodDate: reserve.periodDate,
      });
      await tx
        .update(tasks)
        .set({
          fee: {
            status: 'unknown',
            amountMinor: reserve.amountMinor,
            currency: reserve.currency,
            provider: reserve.provider ?? '',
            model: reserve.model ?? '',
          },
        })
        .where(eq(tasks.id, input.taskId));
    });
  }

  private async lockReserve(tx: DatabaseTransaction, taskId: string) {
    await tx.execute(
      sql`SELECT id FROM usage_ledger WHERE task_id = ${taskId} AND entry_type = 'reserve' FOR UPDATE`,
    );
    const [reserve] = await tx
      .select()
      .from(usageLedger)
      .where(
        and(
          eq(usageLedger.taskId, taskId),
          eq(usageLedger.entryType, 'reserve'),
        ),
      );
    return reserve ?? null;
  }

  private async hasFinalOrUnknown(tx: DatabaseTransaction, taskId: string) {
    const entries = await tx
      .select({ id: usageLedger.id })
      .from(usageLedger)
      .where(
        and(
          eq(usageLedger.taskId, taskId),
          sql`${usageLedger.entryType} IN ('settle_actual', 'release', 'settle_unknown')`,
        ),
      )
      .limit(1);
    return entries.length > 0;
  }

  private async lockAccount(tx: DatabaseTransaction, accountId: string) {
    await tx.execute(
      sql`SELECT id FROM quota_accounts WHERE id = ${accountId} FOR UPDATE`,
    );
  }

  async topup(input: {
    ownerType: 'system' | 'user';
    ownerId?: string;
    amountMinor: number;
    currency: string;
    reason: string;
    actorId: string;
    actorEmail: string;
  }) {
    let account: QuotaAccount;
    if (input.ownerType === 'system') {
      account = await this.quotaRepo.findOrCreateSystemAccount(input.currency);
    } else {
      if (!input.ownerId) {
        throw new Error('ownerId required for user account topup');
      }
      account = await this.quotaRepo.findOrCreateUserAccount(
        input.ownerId,
        input.currency,
      );
    }

    const updated = await this.quotaRepo.topup(account.id, input.amountMinor);
    await this.auditService.log({
      eventType: 'quota.topup',
      actorId: input.actorId,
      actorEmail: input.actorEmail,
      resourceType: 'quota_account',
      resourceId: account.id,
      metadata: {
        ownerType: input.ownerType,
        ownerId: input.ownerId ?? null,
        amountMinor: input.amountMinor,
        currency: input.currency,
        reason: input.reason,
      },
    });

    return this.toDto(updated);
  }
}

function jsonSafe(
  value: Record<string, unknown> | null | undefined,
): Record<string, unknown> | null {
  if (!value) return null;
  return JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
}
