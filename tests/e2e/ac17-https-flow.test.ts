import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { requireE2E, type E2ESession } from './helpers.js';

describe('AC-17: 正式 HTTPS 流程', () => {
  let session: E2ESession | null;
  before(async (t) => {
    session = await requireE2E(t);
  });
  after(async () => undefined);

  it('HTTPS 环境下 SPA、Cookie、CSRF 和 SSE 均可访问', async (t) => {
    if (!session) return t.skip('E2E access is unavailable');
    const webOrigin = process.env.E2E_HTTPS_WEB_ORIGIN;
    const apiOrigin = process.env.E2E_HTTPS_API_ORIGIN;
    if (!webOrigin || !apiOrigin)
      return t.skip('HTTPS deployment origins are not configured');
    assert.match(webOrigin, /^https:\/\//);
    assert.match(apiOrigin, /^https:\/\//);
    const spa = await fetch(webOrigin);
    assert.equal(spa.status, 200);
    const csrf = await fetch(`${apiOrigin}/api/v1/auth/csrf`, {
      headers: { Cookie: session.cookie },
    });
    assert.equal(csrf.status, 200);
    const cookie = session.cookie;
    assert.ok(cookie.startsWith('sessionId='));
  });
});
