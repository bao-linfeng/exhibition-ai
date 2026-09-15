import type { Database, QuotaAccount } from '@exhibition/db';
import type { AuditService } from '../audit/audit.service.js';
import type { QuotaRepository } from './quota.repository.js';

export interface ReserveResult {
  ok: boolean;
  ledgerEntryId?: string;
  accountId: string;
  availableMinor: number;
}

export interface SettleInput {
  taskId: string;
  attemptOrdinal: number | null;
  accountId: string;
  reservedAmountMinor: number;
  actualAmountMinor: number;
  feeStatus: 'actual' | 'unknown';
  currency: string;
  provider: string;
  model: string;
  periodDate: string;
}

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

      const today = new Date().toISOString().slice(0, 10);
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

  async settleTask(input: SettleInput): Promise<void> {
    await this.db.transaction(async (tx) => {
      if (input.feeStatus === 'unknown') {
        await this.quotaRepo.atomicRelease(
          tx,
          input.accountId,
          input.reservedAmountMinor,
        );
        await this.quotaRepo.insertLedgerEntry(tx, {
          taskId: input.taskId,
          attemptOrdinal: input.attemptOrdinal,
          accountId: input.accountId,
          entryType: 'settle_unknown',
          feeStatus: 'unknown',
          amountMinor: input.actualAmountMinor,
          currency: input.currency,
          provider: input.provider,
          model: input.model,
          periodDate: input.periodDate,
        });
        return;
      }

      await this.quotaRepo.atomicSettle(
        tx,
        input.accountId,
        input.reservedAmountMinor,
        input.actualAmountMinor,
      );
      await this.quotaRepo.insertLedgerEntry(tx, {
        taskId: input.taskId,
        attemptOrdinal: input.attemptOrdinal,
        accountId: input.accountId,
        entryType: 'settle_actual',
        feeStatus: 'actual',
        amountMinor: input.actualAmountMinor,
        currency: input.currency,
        provider: input.provider,
        model: input.model,
        periodDate: input.periodDate,
      });
    });
  }

  async releaseReservation(input: {
    taskId: string;
    accountId: string;
    reservedAmountMinor: number;
    currency: string;
    provider: string;
    model: string;
  }): Promise<void> {
    const today = new Date().toISOString().slice(0, 10);
    await this.db.transaction(async (tx) => {
      await this.quotaRepo.atomicRelease(
        tx,
        input.accountId,
        input.reservedAmountMinor,
      );
      await this.quotaRepo.insertLedgerEntry(tx, {
        taskId: input.taskId,
        attemptOrdinal: null,
        accountId: input.accountId,
        entryType: 'release',
        feeStatus: 'estimated',
        amountMinor: input.reservedAmountMinor,
        currency: input.currency,
        provider: input.provider,
        model: input.model,
        periodDate: today,
      });
    });
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
