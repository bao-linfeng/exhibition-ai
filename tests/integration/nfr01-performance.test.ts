import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import {
  createServices,
  initDatabase,
  type Services,
} from '../../packages/backend/src/index.js';
import type { Database } from '../../packages/db/src/index.js';
import {
  cleanupProject,
  insertTestCustomer,
  insertTestProject,
  insertTestUser,
} from '../helpers/db-fixtures.js';
import { percentile } from './helpers.js';

describe('NFR-01: API 查询性能基准', () => {
  let services: Services;
  let db: Database;
  let projectId: string;
  let userId: string;
  before(async () => {
    services = createServices();
    ({ db } = initDatabase());
    const user = await insertTestUser(db);
    userId = user.id;
    const customer = await insertTestCustomer(db, userId);
    projectId = (await insertTestProject(db, customer.id, userId)).id;
  });
  after(async () => {
    await cleanupProject(db, projectId);
    await services.close();
  });

  it('20 个并发项目读取的 P95 小于 500ms', async () => {
    const started = performance.now();
    const samples = await Promise.all(
      Array.from({ length: 20 }, async () => {
        const start = performance.now();
        const project = await services.projectService.getProject(projectId, {
          id: userId,
          role: 'admin',
        });
        assert.notEqual(project, null);
        return performance.now() - start;
      }),
    );
    assert.ok(
      performance.now() - started < 10_000,
      'benchmark did not complete in its bounded window',
    );
    assert.ok(
      percentile(samples, 0.95) < 500,
      `P95=${percentile(samples, 0.95)}ms`,
    );
  });
});
