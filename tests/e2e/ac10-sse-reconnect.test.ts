import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import {
  API_BASE,
  requireE2E,
  requiredFixture,
  type E2ESession,
} from './helpers.js';

describe('AC-10: SSE 断线重连', () => {
  let session: E2ESession | null;
  let projectId: string | null;
  before(async (t) => {
    session = await requireE2E(t);
    projectId = requiredFixture(t, 'E2E_SSE_PROJECT_ID');
  });
  after(async () => undefined);

  it('带 cursor 重连时仅重放后续事件', async (t) => {
    if (!session || !projectId) return t.skip('E2E fixture is unavailable');
    const cursor = Number(process.env.E2E_SSE_CURSOR ?? '0');
    const response = await fetch(
      `${API_BASE}/api/v1/projects/${projectId}/events?after=${cursor}`,
      {
        headers: { Cookie: session.cookie, Accept: 'text/event-stream' },
        signal: AbortSignal.timeout(3_000),
      },
    );
    assert.equal(response.status, 200);
    assert.match(
      response.headers.get('content-type') ?? '',
      /text\/event-stream/,
    );
    const reader = response.body?.getReader();
    assert.ok(reader, 'SSE response must have a body');
    const { value } = await reader.read();
    await reader.cancel();
    const chunk = new TextDecoder().decode(value ?? new Uint8Array());
    if (chunk.includes('id:'))
      assert.doesNotMatch(chunk, new RegExp(`id: ${cursor}\\n`));
  });
});
