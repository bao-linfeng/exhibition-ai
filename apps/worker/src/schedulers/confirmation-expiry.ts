import type { ConfirmationRepository } from '@exhibition/backend';
import { logger } from '@exhibition/backend';

export async function runConfirmationExpiry(
  confirmRepo: ConfirmationRepository,
): Promise<void> {
  try {
    const count = await confirmRepo.expireOldConfirmations();
    if (count > 0) {
      logger.info({ count }, 'Expired pending confirmations');
    }
  } catch (err) {
    logger.error({ err }, 'Confirmation expiry error');
  }
}
