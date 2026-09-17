import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import { eq } from 'drizzle-orm';
import {
  createServices,
  initDatabase,
  type Services,
} from '../../packages/backend/src/index.js';
import type { Database } from '../../packages/db/src/index.js';
import { modelConfigs } from '../../packages/db/src/schema/index.js';
import {
  cleanupProject,
  insertTestCustomer,
  insertTestProject,
  insertTestUser,
} from '../helpers/db-fixtures.js';

describe('NFR-02: 创建任务性能', () => {
  let services: Services;
  let db: Database;
  let projectId: string;
  let userId: string;
  let modelConfigId: string;
  before(async () => {
    process.env.AI_PROVIDER_MODE = 'mock';
    services = createServices();
    ({ db } = initDatabase());
    const user = await insertTestUser(db);
    userId = user.id;
    const customer = await insertTestCustomer(db, userId);
    projectId = (await insertTestProject(db, customer.id, userId)).id;
    modelConfigId = randomUUID();
    await db.insert(modelConfigs).values({
      id: modelConfigId,
      providerId: 'mock',
      modelId: `nfr02-${modelConfigId}`,
      displayName: 'NFR 02 Mock',
      capabilities: [],
      costPerImageMinor: 0,
      currency: 'CNY',
      isActive: true,
      parametersSchema: {},
    });
  });
  after(async () => {
    await cleanupProject(db, projectId);
    await db.delete(modelConfigs).where(eq(modelConfigs.id, modelConfigId));
    await services.close();
  });

  it('Mock 模式下创建任务并返回 taskId 小于 1 秒', async () => {
    const started = performance.now();
    const result = await services.generationService.createGeneration(
      projectId,
      {
        mode: 'generate',
        briefRevisionId: randomUUID(),
        directionId: randomUUID(),
        parentVersionId: null,
        instruction: 'Measure creation latency.',
        modelConfigId,
        parameters: { count: 1, sizePreset: 'square_1_1' },
        expectedProjectRevision: 1,
      },
      userId,
      true,
    );
    assert.equal(typeof result, 'object');
    assert.ok(
      performance.now() - started < 1_000,
      `createGeneration took ${performance.now() - started}ms`,
    );
  });
});
