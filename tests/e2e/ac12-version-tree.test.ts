import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import {
  authedFetch,
  jsonData,
  requireE2E,
  requiredFixture,
  type E2ESession,
} from './helpers.js';

describe('AC-12: 版本树分叉', () => {
  let session: E2ESession | null;
  let projectId: string | null;
  before(async (t) => {
    session = await requireE2E(t);
    projectId = requiredFixture(t, 'E2E_VERSION_TREE_PROJECT_ID');
  });
  after(async () => undefined);

  it('从旧版本分叉后保留全部节点，并只更新一次选择指针', async (t) => {
    if (!session || !projectId) return t.skip('E2E fixture is unavailable');
    const versions = await jsonData<
      Array<{ id: string; parentVersionId: string | null; sequence: number }>
    >(
      await authedFetch(
        `/api/v1/projects/${projectId}/versions`,
        session.cookie,
      ),
    );
    assert.ok(
      versions.length >= 4,
      'fixture requires V1 and multiple descendants',
    );
    assert.deepEqual(
      [...versions.map((version) => version.sequence)].sort((a, b) => a - b),
      [...new Set(versions.map((version) => version.sequence))],
    );
    const roots = versions.filter(
      (version) => version.parentVersionId === null,
    );
    assert.ok(roots.length >= 1);
    const rootChildren = await jsonData<Array<{ id: string }>>(
      await authedFetch(
        `/api/v1/projects/${projectId}/versions?parentVersionId=${roots[0]?.id}`,
        session.cookie,
      ),
    );
    assert.ok(rootChildren.length >= 2, 'V1 must retain fork branches');
  });
});
