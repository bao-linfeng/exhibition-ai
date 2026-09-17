import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import {
  authedFetch,
  requireE2E,
  requiredFixture,
  waitForTask,
  type E2ESession,
} from './helpers.js';

describe('AC-05: Outbox 恢复', () => {
  let session: E2ESession | null;
  let taskId: string | null;
  before(async (t) => {
    process.env.AI_PROVIDER_MODE = 'mock';
    session = await requireE2E(t, { role: 'admin' });
    taskId = requiredFixture(t, 'E2E_OUTBOX_TASK_ID');
  });
  after(async () => undefined);

  it('恢复 Redis 后持久化任务继续处理而不静默丢失', async (t) => {
    if (!session || !taskId)
      return t.skip('requires a task created while Redis was paused');
    const task = await waitForTask(taskId, session.cookie, [
      'succeeded',
      'partially_succeeded',
      'failed',
    ]);
    assert.notEqual(task.status, 'pending');
    const response = await authedFetch(
      `/api/v1/tasks/${taskId}`,
      session.cookie,
    );
    assert.equal(response.ok, true);
  });
});
