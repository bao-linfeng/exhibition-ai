import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import {
  authedFetch,
  jsonData,
  requireE2E,
  requiredFixture,
  type E2ESession,
} from './helpers.js';

describe('AC-09: 并发选图', () => {
  let session: E2ESession | null;
  let projectId: string | null;
  before(async (t) => {
    process.env.AI_PROVIDER_MODE = 'mock';
    session = await requireE2E(t);
    projectId = requiredFixture(t, 'E2E_CONCURRENT_SELECT_PROJECT_ID');
  });
  after(async () => undefined);

  it('相同 revision 的两个选择只有一个成功，版本树不丢失', async (t) => {
    if (!session || !projectId) return t.skip('E2E fixture is unavailable');
    const versions = await jsonData<Array<{ id: string }>>(
      await authedFetch(
        `/api/v1/projects/${projectId}/versions`,
        session.cookie,
      ),
    );
    const [left, right] = versions;
    if (!left || !right)
      return t.skip('fixture requires two selectable versions');
    const revision = Number(process.env.E2E_CONCURRENT_SELECT_REVISION ?? '1');
    const responses = await Promise.all(
      [left, right].map((version) =>
        authedFetch(
          `/api/v1/projects/${projectId}/selected-version`,
          session!.cookie,
          {
            method: 'PUT',
            body: JSON.stringify({
              versionId: version.id,
              expectedRevision: revision,
            }),
          },
        ),
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
    const tree = await jsonData<Array<{ id: string }>>(
      await authedFetch(
        `/api/v1/projects/${projectId}/versions`,
        session.cookie,
      ),
    );
    assert.ok(tree.some((version) => version.id === left.id));
    assert.ok(tree.some((version) => version.id === right.id));
  });
});
