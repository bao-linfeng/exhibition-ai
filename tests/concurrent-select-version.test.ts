import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
import { after, afterEach, before, beforeEach, describe, it } from 'node:test';
import { eq } from 'drizzle-orm';
import {
  createServices,
  initDatabase,
  type Services,
} from '../packages/backend/src/index.js';
import type { Database } from '../packages/db/src/index.js';
import { projects } from '../packages/db/src/schema/index.js';
import {
  cleanupProject,
  insertTestAsset,
  insertTestCustomer,
  insertTestProject,
  insertTestTask,
  insertTestUser,
} from './helpers/db-fixtures.js';

interface VersionFixture {
  projectId: string;
  versionAId: string;
  versionBId: string;
}

describe('concurrent selected version updates', () => {
  let services: Services;
  let db: Database;
  let fixture: VersionFixture;

  before(() => {
    services = createServices();
    ({ db } = initDatabase());
  });

  beforeEach(async () => {
    const user = await insertTestUser(db);
    const customer = await insertTestCustomer(db, user.id);
    const project = await insertTestProject(db, customer.id, user.id);
    const task = await insertTestTask(db, project.id, user.id);
    const [assetA, assetB] = await Promise.all([
      insertTestAsset(db, project.id, user.id),
      insertTestAsset(db, project.id, user.id),
    ]);

    const versions = await services.imageVersionService.publishVersions([
      {
        projectId: project.id,
        taskId: task.id,
        outputOrdinal: 0,
        assetId: assetA.id,
        parentVersionId: null,
        briefRevisionId: randomUUID(),
        width: assetA.width ?? 1280,
        height: assetA.height ?? 720,
        sizeBytes: assetA.sizeBytes,
        mimeType: assetA.mimeType,
        createdBy: user.id,
      },
      {
        projectId: project.id,
        taskId: task.id,
        outputOrdinal: 1,
        assetId: assetB.id,
        parentVersionId: null,
        briefRevisionId: randomUUID(),
        width: assetB.width ?? 1280,
        height: assetB.height ?? 720,
        sizeBytes: assetB.sizeBytes,
        mimeType: assetB.mimeType,
        createdBy: user.id,
      },
    ]);

    const [versionA, versionB] = versions;
    if (!versionA || !versionB)
      throw new Error('Failed to publish test versions');
    fixture = {
      projectId: project.id,
      versionAId: versionA.id,
      versionBId: versionB.id,
    };
  });

  afterEach(async () => {
    await cleanupProject(db, fixture.projectId);
  });

  after(async () => {
    await services.close();
  });

  it('allows exactly one concurrent update at the same revision', async () => {
    const results = await Promise.allSettled([
      services.imageVersionService.updateSelectedVersion(
        fixture.projectId,
        fixture.versionAId,
        1,
        true,
      ),
      services.imageVersionService.updateSelectedVersion(
        fixture.projectId,
        fixture.versionBId,
        1,
        true,
      ),
    ]);
    const values = results.map((result) => {
      if (result.status === 'rejected') throw result.reason;
      return result.value;
    });
    const successes = values.filter(
      (
        value,
      ): value is { selectedVersionId: string | null; revision: number } =>
        typeof value === 'object',
    );

    assert.equal(successes.length, 1);
    assert.equal(values.filter((value) => value === 'conflict').length, 1);

    const [winner] = successes;
    if (!winner)
      throw new Error('Expected one selected version update to succeed');
    assert.equal(winner.revision, 2);

    const [project] = await db
      .select()
      .from(projects)
      .where(eq(projects.id, fixture.projectId));
    assert.equal(project?.revision, 2);
    assert.equal(project?.selectedVersionId, winner.selectedVersionId);
  });

  it('accepts a subsequent update using the new revision', async () => {
    const first = await services.imageVersionService.updateSelectedVersion(
      fixture.projectId,
      fixture.versionAId,
      1,
      true,
    );
    assert.deepEqual(first, {
      selectedVersionId: fixture.versionAId,
      revision: 2,
    });

    const second = await services.imageVersionService.updateSelectedVersion(
      fixture.projectId,
      fixture.versionBId,
      2,
      true,
    );
    assert.deepEqual(second, {
      selectedVersionId: fixture.versionBId,
      revision: 3,
    });
  });
});
