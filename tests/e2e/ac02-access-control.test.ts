import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import {
  authedFetch,
  expectStatus,
  requireE2E,
  requiredFixture,
  type E2ESession,
} from './helpers.js';

describe('AC-02: 非成员访问控制', () => {
  let viewer: E2ESession | null;
  let projectId: string | null;
  before(async (t) => {
    process.env.AI_PROVIDER_MODE = 'mock';
    viewer = await requireE2E(t, { role: 'viewer' });
    projectId = requiredFixture(t, 'E2E_FORBIDDEN_PROJECT_ID');
  });
  after(async () => undefined);

  it('拒绝非成员读取资产、任务、会话和创建生成', async (t) => {
    if (!viewer || !projectId) return t.skip('E2E fixtures are unavailable');
    const assetId = requiredFixture(t, 'E2E_FORBIDDEN_ASSET_ID');
    const taskId = requiredFixture(t, 'E2E_FORBIDDEN_TASK_ID');
    const conversationId = requiredFixture(t, 'E2E_FORBIDDEN_CONVERSATION_ID');
    if (!assetId || !taskId || !conversationId) return;
    await expectStatus(
      await authedFetch(
        `/api/v1/projects/${projectId}/assets/${assetId}`,
        viewer.cookie,
      ),
      403,
    );
    await expectStatus(
      await authedFetch(`/api/v1/tasks/${taskId}`, viewer.cookie),
      403,
    );
    const conversation = await authedFetch(
      `/api/v1/conversations/${conversationId}/messages`,
      viewer.cookie,
    );
    assert.ok([403, 404].includes(conversation.status));
    const create = await authedFetch(
      `/api/v1/projects/${projectId}/generations`,
      viewer.cookie,
      {
        method: 'POST',
        body: JSON.stringify({ idempotencyKey: randomUUID() }),
      },
    );
    assert.ok([400, 403].includes(create.status));
  });
});
