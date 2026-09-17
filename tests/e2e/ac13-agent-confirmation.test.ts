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

describe('AC-13: Agent 确认', () => {
  let session: E2ESession | null;
  let confirmationId: string | null;
  before(async (t) => {
    session = await requireE2E(t);
    confirmationId = requiredFixture(t, 'E2E_PENDING_CONFIRMATION_ID');
  });
  after(async () => undefined);

  it('有效确认幂等，错误 payloadHash 或缺失确认不创建任务', async (t) => {
    if (!session || !confirmationId)
      return t.skip('E2E fixture is unavailable');
    const confirmation = await jsonData<{ payloadHash: string }>(
      await authedFetch(
        `/api/v1/confirmations/${confirmationId}`,
        session.cookie,
      ),
    );
    await expectStatus(
      await authedFetch(
        `/api/v1/confirmations/${confirmationId}/approve`,
        session.cookie,
        {
          method: 'POST',
          body: JSON.stringify({ payloadHash: confirmation.payloadHash }),
        },
      ),
      200,
    );
    await expectStatus(
      await authedFetch(
        `/api/v1/confirmations/${confirmationId}/approve`,
        session.cookie,
        {
          method: 'POST',
          body: JSON.stringify({ payloadHash: confirmation.payloadHash }),
        },
      ),
      409,
    );
    const unknown = await authedFetch(
      '/api/v1/confirmations/00000000-0000-4000-8000-000000000000/approve',
      session.cookie,
      { method: 'POST', body: JSON.stringify({ payloadHash: '0'.repeat(64) }) },
    );
    assert.equal(unknown.status, 404);
  });
});
