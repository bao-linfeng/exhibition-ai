import type { ConversationService } from '@exhibition/backend';
import { logger } from '@exhibition/backend';

export async function runConfirmationExpiry(
  conversationService: ConversationService,
): Promise<void> {
  try {
    const expiredIds = await conversationService.findExpiredConfirmationIds();
    for (const id of expiredIds) {
      const result = await conversationService.handleConfirmationExpiry(id);
      if (result === 'ok') {
        logger.info(
          { confirmationId: id },
          'Expired confirmation and cleaned up run state',
        );
      } else {
        logger.warn(
          { confirmationId: id, result },
          'Expiry handler returned non-ok',
        );
      }
    }
    if (expiredIds.length > 0) {
      logger.info(
        { count: expiredIds.length },
        'Processed expired confirmations',
      );
    }
  } catch (err) {
    logger.error({ err }, 'Confirmation expiry error');
  }
}
