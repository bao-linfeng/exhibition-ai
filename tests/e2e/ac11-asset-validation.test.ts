import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import {
  authedFetch,
  requireE2E,
  requiredFixture,
  type E2ESession,
} from './helpers.js';

describe('AC-11: 上传资产校验', () => {
  let session: E2ESession | null;
  let projectId: string | null;
  before(async (t) => {
    session = await requireE2E(t);
    projectId = requiredFixture(t, 'E2E_UPLOAD_PROJECT_ID');
  });
  after(async () => undefined);

  it('拒绝错误 MIME、超限尺寸和未上传 complete', async (t) => {
    if (!session || !projectId) return t.skip('E2E fixture is unavailable');
    const invalidMime = await authedFetch(
      `/api/v1/projects/${projectId}/assets/uploads`,
      session.cookie,
      {
        method: 'POST',
        body: JSON.stringify({
          kind: 'logo',
          originalFilename: 'logo.gif',
          sizeBytes: 10,
          mimeType: 'image/gif',
        }),
      },
    );
    assert.equal(invalidMime.status, 400);
    const oversized = await authedFetch(
      `/api/v1/projects/${projectId}/assets/uploads`,
      session.cookie,
      {
        method: 'POST',
        body: JSON.stringify({
          kind: 'logo',
          originalFilename: 'logo.png',
          sizeBytes: 26_214_401,
          mimeType: 'image/png',
        }),
      },
    );
    assert.equal(oversized.status, 400);
    const uploadId = requiredFixture(t, 'E2E_NOT_UPLOADED_SESSION_ID');
    if (!uploadId) return;
    const complete = await authedFetch(
      `/api/v1/projects/${projectId}/assets/uploads/${uploadId}/complete`,
      session.cookie,
      { method: 'POST', body: '{}' },
    );
    assert.equal(complete.status, 422);
  });
});
