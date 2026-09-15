import type { TaskService } from '@exhibition/backend';
import { logger } from '@exhibition/backend';

const STUCK_THRESHOLD_MS = 15 * 60 * 1000;

export async function runTimeoutReconciler(
  taskService: TaskService,
): Promise<void> {
  try {
    await taskService.scanAndMarkStuckTasks(STUCK_THRESHOLD_MS);
  } catch (err) {
    logger.error({ err }, 'Timeout reconciler error');
  }
}
