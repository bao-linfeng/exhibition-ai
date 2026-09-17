import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { eq } from 'drizzle-orm';
import {
  createServices,
  initDatabase,
  type Services,
} from '../../packages/backend/src/index.js';
import type { Database } from '../../packages/db/src/index.js';
import { auditLogs } from '../../packages/db/src/schema/index.js';
import {
  cleanupProject,
  insertTestCustomer,
  insertTestProject,
  insertTestUser,
} from '../helpers/db-fixtures.js';

describe('NFR-06: 审计安全', () => {
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

  it('关键资源操作可追加审计且不暴露 secret', async () => {
    await services.auditService.log({
      eventType: 'project.updated',
      actorId: userId,
      actorEmail: 'integration@example.test',
      projectId,
      resourceType: 'project',
      resourceId: projectId,
      metadata: { action: 'NFR-06 security verification' },
    });
    const [entry] = await db
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.projectId, projectId));
    assert.ok(entry);
    assert.equal(entry.actorId, userId);
    assert.equal(entry.eventType, 'project.updated');
    assert.doesNotMatch(
      JSON.stringify(entry.metadata),
      /password|secret|token/i,
    );
  });
});
