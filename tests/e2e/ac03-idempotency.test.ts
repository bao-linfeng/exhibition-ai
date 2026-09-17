import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import {
  authedFetch,
  expectStatus,
  jsonData,
  requireE2E,
  requiredFixture,
  type E2ESession,
} from './helpers.js';

describe('AC-03: 生成请求幂等性', () => {
  let session: E2ESession | null;
  let projectId: string | null;
  before(async (t) => {
    process.env.AI_PROVIDER_MODE = 'mock';
    session = await requireE2E(t);
    projectId = requiredFixture(t, 'E2E_IDEMPOTENCY_PROJECT_ID');
  });
  after(async () => undefined);

  it('相同 key 返回相同任务，不同输入返回 409', async (t) => {
    if (!session || !projectId) return t.skip('E2E fixture is unavailable');
    const request = process.env.E2E_GENERATION_REQUEST;
    if (!request)
      return t.skip('E2E_GENERATION_REQUEST must contain a valid request JSON');
    const key = randomUUID();
    const send = (body: string) =>
      authedFetch(
        `/api/v1/projects/${projectId}/generations`,
        session!.cookie,
        { method: 'POST', headers: { 'Idempotency-Key': key }, body },
      );
    const first = await send(request);
    await expectStatus(first, 202);
    const second = await send(request);
    await expectStatus(second, 202);
    assert.equal(
      (await jsonData<{ taskId: string }>(first)).taskId,
      (await jsonData<{ taskId: string }>(second)).taskId,
    );
    const changed = JSON.stringify({
      ...(JSON.parse(request) as Record<string, unknown>),
      instruction: `changed-${randomUUID()}`,
    });
    await expectStatus(await send(changed), 409);
  });
});
