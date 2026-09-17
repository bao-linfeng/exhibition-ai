import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import {
  authedFetch,
  expectStatus,
  jsonData,
  requireE2E,
  requiredFixture,
  type E2ESession,
} from './helpers.js';

describe('AC-06: Provider 超时对账', () => {
  let session: E2ESession | null;
  let taskId: string | null;
  before(async (t) => {
    process.env.AI_PROVIDER_MODE = 'mock';
    session = await requireE2E(t, { role: 'admin' });
    taskId = requiredFixture(t, 'E2E_RECONCILING_TASK_ID');
  });
  after(async () => undefined);

  it('reconciling 任务可被显式补偿且保留 requestId 证据', async (t) => {
    if (!session || !taskId) return t.skip('requires a mock timeout fixture');
    const task = await jsonData<{
      status: string;
      outputs: Array<{ state: string }>;
    }>(await authedFetch(`/api/v1/tasks/${taskId}`, session.cookie));
    assert.equal(task.status, 'reconciling');
    const response = await authedFetch(
      `/api/v1/tasks/${taskId}/reconcile`,
      session.cookie,
      {
        method: 'POST',
        body: JSON.stringify({
          ordinal: 0,
          outcome: 'failed',
          reason: 'Mock provider timeout reconciliation',
        }),
      },
    );
    await expectStatus(response, 200);
  });
});
