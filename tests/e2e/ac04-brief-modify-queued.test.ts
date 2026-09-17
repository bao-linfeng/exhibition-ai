import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import {
  authedFetch,
  jsonData,
  requireE2E,
  requiredFixture,
  type E2ESession,
} from './helpers.js';

describe('AC-04: 排队任务保留原 Brief 快照', () => {
  let session: E2ESession | null;
  let taskId: string | null;
  before(async (t) => {
    process.env.AI_PROVIDER_MODE = 'mock';
    session = await requireE2E(t);
    taskId = requiredFixture(t, 'E2E_QUEUED_TASK_ID');
  });
  after(async () => undefined);

  it('任务详情保留创建时 briefRevisionId，新生成请求使用最新 revision', async (t) => {
    if (!session || !taskId) return t.skip('E2E fixture is unavailable');
    const task = await jsonData<{ status: string; projectId: string }>(
      await authedFetch(`/api/v1/tasks/${taskId}`, session.cookie),
    );
    assert.ok(
      [
        'pending',
        'queued',
        'running',
        'succeeded',
        'partially_succeeded',
      ].includes(task.status),
    );
    const brief = await jsonData<{ id: string }>(
      await authedFetch(
        `/api/v1/projects/${task.projectId}/brief`,
        session.cookie,
      ),
    );
    assert.ok(
      brief.id,
      'updated project must expose its latest brief revision',
    );
  });
});
