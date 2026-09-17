import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import {
  authedFetch,
  requireE2E,
  requiredFixture,
  type E2ESession,
} from './helpers.js';

describe('AC-14: 并发修改', () => {
  let session: E2ESession | null;
  let projectId: string | null;
  before(async (t) => {
    session = await requireE2E(t);
    projectId = requiredFixture(t, 'E2E_CONCURRENT_MODIFY_PROJECT_ID');
  });
  after(async () => undefined);

  it('相同 expectedRevision 的两次修改只有一个提交', async (t) => {
    if (!session || !projectId) return t.skip('E2E fixture is unavailable');
    const payload = process.env.E2E_CONCURRENT_MODIFY_REQUEST;
    if (!payload)
      return t.skip(
        'E2E_CONCURRENT_MODIFY_REQUEST must contain a valid PATCH body',
      );
    const responses = await Promise.all(
      [1, 2].map(() =>
        authedFetch(`/api/v1/projects/${projectId}`, session!.cookie, {
          method: 'PATCH',
          body: payload,
        }),
      ),
    );
    assert.equal(
      responses.filter((response) => response.status === 200).length,
      1,
    );
    assert.equal(
      responses.filter((response) => response.status === 409).length,
      1,
    );
  });
});
