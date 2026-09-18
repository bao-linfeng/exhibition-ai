import type { TaskService } from '@exhibition/backend';
import { logger } from '@exhibition/backend';

const STUCK_RUNNING_THRESHOLD_MS = 15 * 60 * 1000;
const STUCK_RECONCILING_THRESHOLD_MS = 30 * 60 * 1000;

export async function runTimeoutReconciler(
  taskService: TaskService,
): Promise<void> {
  try {
    await taskService.scanAndMarkStuckTasks(STUCK_RUNNING_THRESHOLD_MS);
  } catch (err) {
    logger.error({ err }, 'Timeout reconciler error (running → reconciling)');
  }

  try {
    await taskService.scanAndFailStuckReconciling(
      STUCK_RECONCILING_THRESHOLD_MS,
    );
  } catch (err) {
    logger.error({ err }, 'Timeout reconciler error (reconciling → failed)');
  }
}
