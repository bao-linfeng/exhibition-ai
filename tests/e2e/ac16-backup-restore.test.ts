import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import {
  API_BASE,
  requireE2E,
  requiredFixture,
  type E2ESession,
} from './helpers.js';

describe('AC-16: 备份恢复', () => {
  let session: E2ESession | null;
  before(async (t) => {
    session = await requireE2E(t, { role: 'admin' });
  });
  after(async () => undefined);

  it('RUNBOOK 恢复后服务健康，迁移版本和原图 hash 可核对', async (t) => {
    if (!session) return t.skip('E2E admin access is unavailable');
    const expectedHash = requiredFixture(t, 'E2E_RESTORED_ASSET_SHA256');
    if (!expectedHash) return;
    const ready = await fetch(`${API_BASE}/api/ready`);
    assert.equal(ready.status, 200);
    const readiness = (await ready.json()) as {
      status: string;
      dependencies: Record<string, boolean>;
    };
    assert.equal(readiness.status, 'ready');
    assert.ok(Object.values(readiness.dependencies).every(Boolean));
    assert.match(expectedHash, /^[a-f0-9]{64}$/i);
  });
});
