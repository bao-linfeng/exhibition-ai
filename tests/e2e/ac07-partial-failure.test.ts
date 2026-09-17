import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import {
  authedFetch,
  jsonData,
  requireE2E,
  requiredFixture,
  type E2ESession,
} from './helpers.js';

describe('AC-07: 部分失败结果', () => {
  let session: E2ESession | null;
  let taskId: string | null;
  before(async (t) => {
    process.env.AI_PROVIDER_MODE = 'mock';
    session = await requireE2E(t);
    taskId = requiredFixture(t, 'E2E_PARTIAL_FAILURE_TASK_ID');
  });
  after(async () => undefined);

  it('保留两张成功输出且仅标记一张失败输出', async (t) => {
    if (!session || !taskId)
      return t.skip('requires a partial-failure fixture');
    const task = await jsonData<{
      status: string;
      outputs: Array<{
        state: string;
        versionId: string | null;
        errorCode: string | null;
      }>;
    }>(await authedFetch(`/api/v1/tasks/${taskId}`, session.cookie));
    assert.equal(task.status, 'partially_succeeded');
    assert.equal(
      task.outputs.filter(
        (output) => output.state === 'succeeded' && output.versionId,
      ).length,
      2,
    );
    assert.equal(
      task.outputs.filter(
        (output) => output.state === 'failed' && output.errorCode,
      ).length,
      1,
    );
  });
});
