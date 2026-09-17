import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import {
  authedFetch,
  expectStatus,
  jsonData,
  requireE2E,
  requiredFixture,
  waitForTask,
  type E2ESession,
} from './helpers.js';

describe('AC-01: 完整设计流程', () => {
  let session: E2ESession | null;
  let projectId: string | null;

  before(async (t) => {
    process.env.AI_PROVIDER_MODE = 'mock';
    session = await requireE2E(t);
    projectId = requiredFixture(t, 'E2E_PROJECT_ID');
  });

  after(async () => undefined);

  it('确认 Brief 后生成三图并选择一个版本', async (t) => {
    if (!session || !projectId)
      return t.skip('E2E prerequisites are unavailable');
    const brief = await jsonData<{ id: string }>(
      await authedFetch(`/api/v1/projects/${projectId}/brief`, session.cookie),
    );
    assert.ok(brief.id, 'fixture project requires a current brief revision');
    const directions = await jsonData<Array<{ id: string }>>(
      await authedFetch(
        `/api/v1/projects/${projectId}/design-directions`,
        session.cookie,
      ),
    );
    const direction = directions[0];
    const modelConfigId = process.env.E2E_MODEL_CONFIG_ID;
    if (!direction || !modelConfigId)
      return t.skip('direction/model fixture is unavailable');

    const generation = await authedFetch(
      `/api/v1/projects/${projectId}/generations`,
      session.cookie,
      {
        method: 'POST',
        headers: { 'Idempotency-Key': randomUUID() },
        body: JSON.stringify({
          mode: 'generate',
          briefRevisionId: brief.id,
          directionId: direction.id,
          parentVersionId: null,
          instruction: 'Create three traceable exhibition concepts.',
          modelConfigId,
          parameters: { count: 3, sizePreset: 'landscape_16_9' },
          expectedProjectRevision: Number(
            process.env.E2E_PROJECT_REVISION ?? '1',
          ),
        }),
      },
    );
    await expectStatus(generation, 202);
    const { taskId } = await jsonData<{ taskId: string }>(generation);
    const task = await waitForTask(taskId, session.cookie, [
      'succeeded',
      'partially_succeeded',
    ]);
    assert.equal(
      task.outputs.filter((output) => output.state === 'succeeded').length,
      3,
    );

    const versions = await jsonData<Array<{ id: string }>>(
      await authedFetch(
        `/api/v1/projects/${projectId}/versions`,
        session.cookie,
      ),
    );
    const selected = versions.at(-1);
    assert.ok(selected, 'generation must publish versions');
    const response = await authedFetch(
      `/api/v1/projects/${projectId}/selected-version`,
      session.cookie,
      {
        method: 'PUT',
        body: JSON.stringify({
          versionId: selected.id,
          expectedRevision: Number(process.env.E2E_PROJECT_REVISION ?? '1'),
        }),
      },
    );
    await expectStatus(response, 200);
  });
});
