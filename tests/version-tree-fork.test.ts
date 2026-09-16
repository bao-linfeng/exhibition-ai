import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import {
  createServices,
  initDatabase,
  type Services,
} from '../packages/backend/src/index.js';
import { ImageVersionRepository } from '../packages/backend/src/modules/image-versions/image-versions.repository.js';
import type { Database } from '../packages/db/src/index.js';
import {
  insertTestAsset,
  insertTestCustomer,
  insertTestProject,
  insertTestTask,
  insertTestUser,
  cleanupProject,
} from './helpers/db-fixtures.js';

describe('image version tree forks', () => {
  let services: Services;
  let db: Database;
  let repository: ImageVersionRepository;
  let projectId: string;
  let taskId: string;
  let userId: string;

  before(async () => {
    services = createServices();
    ({ db } = initDatabase());
    repository = new ImageVersionRepository(db);

    const user = await insertTestUser(db);
    const customer = await insertTestCustomer(db, user.id);
    const project = await insertTestProject(db, customer.id, user.id);
    const task = await insertTestTask(db, project.id, user.id);
    projectId = project.id;
    taskId = task.id;
    userId = user.id;
  });

  after(async () => {
    await cleanupProject(db, projectId);
    await services.close();
  });

  it('retains every branch after selecting an older branch', async () => {
    const publish = async (parentVersionId: string | null) => {
      const asset = await insertTestAsset(db, projectId, userId);
      const [version] = await repository.publishVersions([
        {
          projectId,
          taskId,
          outputOrdinal: 0,
          assetId: asset.id,
          parentVersionId,
          briefRevisionId: randomUUID(),
          width: asset.width ?? 1280,
          height: asset.height ?? 720,
          sizeBytes: asset.sizeBytes,
          mimeType: asset.mimeType,
          createdBy: userId,
        },
      ]);

      if (!version) throw new Error('Failed to publish image version');
      return version;
    };

    const v1 = await publish(null);
    const v2a = await publish(v1.id);
    const v2b = await publish(v1.id);
    const v3 = await publish(v2a.id);

    const allVersions = await repository.listByProject({ projectId });
    assert.equal(allVersions.data.length, 4);
    assert.deepEqual(
      allVersions.data.map((version) => version.sequence).sort((a, b) => a - b),
      [1, 2, 3, 4],
    );

    const v1Children = await repository.listByProject({
      projectId,
      parentVersionId: v1.id,
    });
    assert.deepEqual(
      new Set(v1Children.data.map((version) => version.id)),
      new Set([v2a.id, v2b.id]),
    );

    const v2aChildren = await repository.listByProject({
      projectId,
      parentVersionId: v2a.id,
    });
    assert.deepEqual(
      v2aChildren.data.map((version) => version.id),
      [v3.id],
    );

    const roots = await repository.listByProject({
      projectId,
      parentVersionId: 'root',
    });
    assert.deepEqual(
      roots.data.map((version) => version.id),
      [v1.id],
    );

    const selected = await repository.updateSelectedVersion(
      projectId,
      v2b.id,
      1,
    );
    assert.deepEqual(selected, { selectedVersionId: v2b.id, revision: 2 });

    const afterSelection = await repository.listByProject({ projectId });
    assert.deepEqual(
      new Set(afterSelection.data.map((version) => version.id)),
      new Set([v1.id, v2a.id, v2b.id, v3.id]),
    );
    assert.ok(afterSelection.data.some((version) => version.id === v2a.id));
    assert.ok(afterSelection.data.some((version) => version.id === v3.id));
  });
});
