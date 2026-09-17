import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import { eq } from 'drizzle-orm';
import {
  createServices,
  initDatabase,
  type Services,
} from '../../packages/backend/src/index.js';
import type { Database } from '../../packages/db/src/index.js';
import { taskOutbox, tasks } from '../../packages/db/src/schema/index.js';
import {
  cleanupProject,
  insertTestCustomer,
  insertTestProject,
  insertTestUser,
} from '../helpers/db-fixtures.js';

describe('NFR-08: Worker 重投幂等性', () => {
  let services: Services;
  let db: Database;
  let projectId: string;
  let userId: string;
  before(async () => {
    services = createServices();
    ({ db } = initDatabase());
    const user = await insertTestUser(db);
    userId = user.id;
    const customer = await insertTestCustomer(db, userId);
    projectId = (await insertTestProject(db, customer.id, userId)).id;
  });
  after(async () => {
    await cleanupProject(db, projectId);
    await services.close();
  });

  it('同一个 outbox jobId 在重投时对应单一持久化任务', async () => {
    const task = await services.taskService.enqueueAssetValidation({
      projectId,
      idempotencyKey: randomUUID(),
      requestedBy: userId,
      payload: { assetId: randomUUID() },
    });
    if (task === 'duplicate') throw new Error('Unexpected duplicate task');
    assert.ok(task.id);
    const [persisted] = await db
      .select()
      .from(tasks)
      .where(eq(tasks.id, task.id));
    assert.ok(persisted);
    const outboxes = await db
      .select()
      .from(taskOutbox)
      .where(eq(taskOutbox.taskId, task.id));
    assert.equal(outboxes.length, 1);
    assert.ok(outboxes[0]?.id, 'outbox ID is the stable BullMQ jobId');
  });
});
