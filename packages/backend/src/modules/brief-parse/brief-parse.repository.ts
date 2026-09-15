import { eq } from 'drizzle-orm';
import type { Database } from '@exhibition/db';
import { tasks, taskOutbox } from '@exhibition/db';
import { QUEUE_BRIEF_PARSE } from '../../infrastructure/queue.js';

export class BriefParseRepository {
  constructor(private db: Database) {}

  async createWithOutbox(input: {
    projectId: string;
    requestedBy: string;
    idempotencyKey: string;
    text: string;
    baseBriefRevisionId: string | null;
    inputSnapshot: Record<string, unknown>;
  }) {
    return this.db.transaction(async (tx) => {
      const [task] = await tx
        .insert(tasks)
        .values({
          projectId: input.projectId,
          kind: 'brief_parse',
          idempotencyKey: input.idempotencyKey,
          inputSnapshot: input.inputSnapshot,
          requestedBy: input.requestedBy,
          status: 'pending',
          outputs: [],
          canCancel: true,
          canRetry: false,
        })
        .returning();
      if (!task) throw new Error('Failed to insert task');

      const [outboxRow] = await tx
        .insert(taskOutbox)
        .values({
          taskId: task.id,
          queueName: QUEUE_BRIEF_PARSE,
          payload: {
            taskId: task.id,
            projectId: input.projectId,
            outboxId: '__placeholder__',
          },
        })
        .returning();
      if (!outboxRow) throw new Error('Failed to insert outbox');

      const payload = {
        taskId: task.id,
        projectId: input.projectId,
        outboxId: outboxRow.id,
      };
      await tx
        .update(taskOutbox)
        .set({ payload })
        .where(eq(taskOutbox.id, outboxRow.id));
      return { task, outbox: { ...outboxRow, payload } };
    });
  }
}
