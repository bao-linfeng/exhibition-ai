import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { eq } from 'drizzle-orm';
import type { CreateGenerationRequest } from '../packages/contracts/src/index.js';
import type { Services } from '../packages/backend/src/index.js';
import type { Database } from '../packages/db/src/index.js';
import { modelConfigs } from '../packages/db/src/schema/index.js';
import {
  cleanupProject,
  insertTestCustomer,
  insertTestProject,
  insertTestUser,
} from './helpers/db-fixtures.js';

describe('edit generation brief acknowledgement idempotency', () => {
  let services: Services;
  let db: Database;
  let projectId: string;
  let userId: string;
  let modelConfigId: string;
  let createdModelConfig = false;

  before(async () => {
    process.env.AI_PROVIDER_MODE = 'mock';
    const backend = await import('../packages/backend/src/index.js');
    services = backend.createServices();
    ({ db } = backend.initDatabase());

    const user = await insertTestUser(db);
    const customer = await insertTestCustomer(db, user.id);
    const project = await insertTestProject(db, customer.id, user.id);
    projectId = project.id;
    userId = user.id;
    const [existingModelConfig] = await db
      .select()
      .from(modelConfigs)
      .where(eq(modelConfigs.modelId, 'mock-full'));
    if (existingModelConfig) {
      modelConfigId = existingModelConfig.id;
    } else {
      modelConfigId = randomUUID();
      createdModelConfig = true;
      await db.insert(modelConfigs).values({
        id: modelConfigId,
        providerId: 'mock',
        modelId: 'mock-full',
        displayName: `Integration Mock Model ${modelConfigId}`,
        capabilities: [],
        costPerImageMinor: 0,
        currency: 'CNY',
        isActive: true,
        parametersSchema: {},
      });
    }
  });

  after(async () => {
    await cleanupProject(db, projectId);
    if (createdModelConfig) {
      await db.delete(modelConfigs).where(eq(modelConfigs.id, modelConfigId));
    }
    await services.close();
  });

  it('treats acknowledgement state as part of the idempotency input', async () => {
    const baseRequest: CreateGenerationRequest = {
      mode: 'edit',
      briefRevisionId: randomUUID(),
      parentVersionId: randomUUID(),
      instruction:
        'Adjust the layout while preserving the original visual style.',
      modelConfigId,
      parameters: { count: 1, sizePreset: 'square_1_1' },
      expectedProjectRevision: 1,
    };

    const withoutAcknowledgement =
      await services.generationService.createGeneration(
        projectId,
        baseRequest,
        userId,
        true,
      );
    assert.equal(typeof withoutAcknowledgement, 'object');
    if (typeof withoutAcknowledgement !== 'object') {
      throw new Error(
        'Expected generation without acknowledgement to be created',
      );
    }
    assert.equal(withoutAcknowledgement.status, 'pending');

    const acknowledgedRequest: CreateGenerationRequest = {
      ...baseRequest,
      acknowledgeBriefChange: true,
    };
    const withAcknowledgement =
      await services.generationService.createGeneration(
        projectId,
        acknowledgedRequest,
        userId,
        true,
      );
    assert.equal(typeof withAcknowledgement, 'object');
    if (typeof withAcknowledgement !== 'object') {
      throw new Error('Expected acknowledged generation to be created');
    }
    assert.equal(withAcknowledgement.status, 'pending');
    assert.notEqual(withAcknowledgement.taskId, withoutAcknowledgement.taskId);

    const duplicateAcknowledgedRequest =
      await services.generationService.createGeneration(
        projectId,
        acknowledgedRequest,
        userId,
        true,
      );
    assert.equal(typeof duplicateAcknowledgedRequest, 'object');
    if (typeof duplicateAcknowledgedRequest !== 'object') {
      throw new Error(
        'Expected duplicate acknowledged generation to be idempotent',
      );
    }
    assert.equal(duplicateAcknowledgedRequest.status, 'pending');
    assert.equal(
      duplicateAcknowledgedRequest.taskId,
      withAcknowledgement.taskId,
    );
  });
});
