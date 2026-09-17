import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import {
  authedFetch,
  jsonData,
  requireE2E,
  requiredFixture,
  type E2ESession,
} from './helpers.js';

describe('AC-15: 项目生命周期限制', () => {
  let session: E2ESession | null;
  let projectId: string | null;
  before(async (t) => {
    session = await requireE2E(t);
    projectId = requiredFixture(t, 'E2E_LIFECYCLE_PROJECT_ID');
  });
  after(async () => undefined);

  it('approved 或 archived 项目拒绝修改并保持合法状态转换', async (t) => {
    if (!session || !projectId) return t.skip('E2E fixture is unavailable');
    const project = await jsonData<{ status: string; revision: number }>(
      await authedFetch(`/api/v1/projects/${projectId}`, session.cookie),
    );
    assert.ok(['approved', 'archived'].includes(project.status));
    const update = await authedFetch(
      `/api/v1/projects/${projectId}`,
      session.cookie,
      {
        method: 'PATCH',
        body: JSON.stringify({
          name: 'must not modify',
          expectedRevision: project.revision,
        }),
      },
    );
    assert.equal(update.status, 409);
    if (project.status === 'approved') {
      const archive = await authedFetch(
        `/api/v1/projects/${projectId}/transitions`,
        session.cookie,
        {
          method: 'POST',
          body: JSON.stringify({
            action: 'archive',
            expectedRevision: project.revision,
          }),
        },
      );
      assert.equal(archive.status, 200);
    }
  });
});
