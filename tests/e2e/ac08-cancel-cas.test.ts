import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import {
  authedFetch,
  requireE2E,
  requiredFixture,
  type E2ESession,
} from './helpers.js';

describe('AC-08: 取消操作 CAS', () => {
  let session: E2ESession | null;
  let taskId: string | null;
  before(async (t) => {
    process.env.AI_PROVIDER_MODE = 'mock';
    session = await requireE2E(t);
    taskId = requiredFixture(t, 'E2E_CANCELLABLE_TASK_ID');
  });
  after(async () => undefined);

  it('两个同时取消请求至多一个成功，终态不会回写为成功', async (t) => {
    if (!session || !taskId) return t.skip('requires a queued/running fixture');
    const results = await Promise.all(
      [1, 2].map(() =>
        authedFetch(`/api/v1/tasks/${taskId}/cancel`, session!.cookie, {
          method: 'POST',
        }),
      ),
    );
    assert.equal(
      results.filter((response) => response.status === 200).length,
      1,
    );
    assert.ok(results.some((response) => response.status === 409));
    const task = (await (
      await authedFetch(`/api/v1/tasks/${taskId}`, session.cookie)
    ).json()) as { data: { status: string } };
    assert.equal(task.data.status, 'cancelled');
  });
});
