import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import {
  authedFetch,
  requireE2E,
  requiredFixture,
  type E2ESession,
} from './helpers.js';

describe('AC-18: 模型与额度验证', () => {
  let session: E2ESession | null;
  let projectId: string | null;
  before(async (t) => {
    process.env.AI_PROVIDER_MODE = 'mock';
    session = await requireE2E(t);
    projectId = requiredFixture(t, 'E2E_MODEL_VALIDATION_PROJECT_ID');
  });
  after(async () => undefined);

  it('disabled、unknown 和不支持 edit 的模型被明确拒绝', async (t) => {
    if (!session || !projectId) return t.skip('E2E fixture is unavailable');
    const request = process.env.E2E_MODEL_VALIDATION_REQUEST;
    if (!request)
      return t.skip(
        'E2E_MODEL_VALIDATION_REQUEST must contain a valid generate request',
      );
    const cases: Array<{ env: string; expected: number }> = [
      { env: 'E2E_DISABLED_MODEL_ID', expected: 409 },
      { env: 'E2E_UNKNOWN_MODEL_ID', expected: 404 },
      { env: 'E2E_NO_EDIT_MODEL_ID', expected: 503 },
    ];
    for (const modelCase of cases) {
      const modelConfigId = process.env[modelCase.env];
      if (!modelConfigId) return t.skip(`${modelCase.env} is not configured`);
      const body = JSON.stringify({
        ...(JSON.parse(request) as Record<string, unknown>),
        modelConfigId,
        mode: modelCase.env === 'E2E_NO_EDIT_MODEL_ID' ? 'edit' : 'generate',
      });
      const response = await authedFetch(
        `/api/v1/projects/${projectId}/generations`,
        session.cookie,
        { method: 'POST', body },
      );
      assert.equal(response.status, modelCase.expected);
    }
  });
});
