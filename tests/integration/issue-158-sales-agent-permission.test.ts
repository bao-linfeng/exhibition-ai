import assert from 'node:assert/strict';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import { count, eq } from 'drizzle-orm';
import {
  createServices,
  initDatabase,
  type Services,
} from '../../packages/backend/src/index.js';
import type { Database } from '../../packages/db/src/index.js';
import {
  agentRuns,
  confirmations,
  conversations,
  customers,
  messages,
  projectMembers,
  projects,
  sessions,
  tasks,
  users,
} from '../../packages/db/src/schema/index.js';
import { buildApp } from '../../apps/api/src/app.js';
import { deriveCsrfToken } from '../../apps/api/src/plugins/csrf.js';
import { cleanupProject } from '../helpers/db-fixtures.js';
import { testRunId } from './helpers.js';

type Role = 'admin' | 'designer' | 'sales' | 'viewer';

interface Scenario {
  actorId: string;
  customerId: string;
  projectId: string;
  sessionId: string;
}

interface ProjectRowCounts {
  conversations: number;
  messages: number;
  runs: number;
  tasks: number;
}

const confirmationPayloadHash = 'a'.repeat(64);
let app: Awaited<ReturnType<typeof buildApp>>;

const briefPatch = {
  booth: {
    widthM: 6,
    depthM: 6,
    heightLimitM: 4,
    openSides: ['front'],
  },
  brand: { name: 'Issue 158 Test Brand' },
  functionalAreas: [{ type: 'reception', required: true, quantity: 1 }],
  style: { keywords: ['modern'] },
};

describe('Issue #158: Sales Agent 会话权限控制', () => {
  let services: Services;
  let db: Database;

  before(async () => {
    services = createServices();
    ({ db } = initDatabase());
    app = await buildApp(services);
  });

  after(async () => {
    await app.close();
  });

  it('Sales 项目成员发送对话消息时返回 403，且不创建消息、任务或运行', async () => {
    const scenario = await createScenario(db, 'sales', true);
    try {
      const beforeCounts = await projectRowCounts(db, scenario.projectId);
      const response = await sendConversationMessage(scenario);

      assertForbidden(
        response.statusCode,
        response.body,
        'Only admin and designer roles can start Agent sessions',
      );
      assert.deepEqual(
        await projectRowCounts(db, scenario.projectId),
        beforeCounts,
      );
    } finally {
      await cleanupScenario(db, scenario);
    }
  });

  it('Designer 项目成员能够发送对话消息并创建 Agent 运行', async () => {
    const scenario = await createScenario(db, 'designer', true);
    try {
      const response = await sendConversationMessage(scenario);

      assert.equal(response.statusCode, 202, response.body);
      const result = JSON.parse(response.body) as {
        data: { messageId: string; runId: string; taskId: string | null };
      };
      assert.ok(result.data.messageId);
      assert.ok(result.data.runId);
      assert.ok(result.data.taskId);

      const [run] = await db
        .select()
        .from(agentRuns)
        .where(eq(agentRuns.id, result.data.runId));
      assert.equal(run?.projectId, scenario.projectId);
      assert.equal(run?.taskId, result.data.taskId);

      const counts = await projectRowCounts(db, scenario.projectId);
      assert.equal(counts.conversations, 1);
      assert.equal(counts.messages, 2);
      assert.equal(counts.runs, 1);
      assert.equal(counts.tasks, 1);
    } finally {
      await cleanupScenario(db, scenario);
    }
  });

  it('Admin 用户无需项目成员身份也能够发送对话消息', async () => {
    const scenario = await createScenario(db, 'admin', false);
    try {
      const response = await sendConversationMessage(scenario);

      assert.equal(response.statusCode, 202, response.body);
      const result = JSON.parse(response.body) as {
        data: { runId: string; taskId: string | null };
      };
      assert.ok(result.data.runId);
      assert.ok(result.data.taskId);

      const counts = await projectRowCounts(db, scenario.projectId);
      assert.equal(counts.conversations, 1);
      assert.equal(counts.messages, 2);
      assert.equal(counts.runs, 1);
      assert.equal(counts.tasks, 1);
    } finally {
      await cleanupScenario(db, scenario);
    }
  });

  it('Viewer 项目成员发送对话消息时返回 403，且不创建消息、任务或运行', async () => {
    const scenario = await createScenario(db, 'viewer', true);
    try {
      const beforeCounts = await projectRowCounts(db, scenario.projectId);
      const response = await sendConversationMessage(scenario);

      assertForbidden(
        response.statusCode,
        response.body,
        'Only admin and designer roles can start Agent sessions',
      );
      assert.deepEqual(
        await projectRowCounts(db, scenario.projectId),
        beforeCounts,
      );
    } finally {
      await cleanupScenario(db, scenario);
    }
  });

  it('Sales 项目成员批准确认时返回 403，且确认和现有任务保持不变', async () => {
    const scenario = await createScenario(db, 'sales', true);
    try {
      const confirmation = await createPendingConfirmation(db, scenario);
      const beforeCounts = await projectRowCounts(db, scenario.projectId);
      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/confirmations/${confirmation.id}/approve`,
        headers: authenticatedHeaders(scenario.sessionId),
        payload: { payloadHash: confirmationPayloadHash },
      });

      assertForbidden(
        response.statusCode,
        response.body,
        'Only admin and designer roles can approve confirmations',
      );
      await assertConfirmationStatus(db, confirmation.id, 'pending');
      assert.deepEqual(
        await projectRowCounts(db, scenario.projectId),
        beforeCounts,
      );
    } finally {
      await cleanupScenario(db, scenario);
    }
  });

  it('Designer 项目成员能够批准确认并应用待确认的变更', async () => {
    const scenario = await createScenario(db, 'designer', true);
    try {
      const confirmation = await createPendingConfirmation(db, scenario);
      const beforeCounts = await projectRowCounts(db, scenario.projectId);
      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/confirmations/${confirmation.id}/approve`,
        headers: authenticatedHeaders(scenario.sessionId),
        payload: { payloadHash: confirmationPayloadHash },
      });

      assert.equal(response.statusCode, 200, response.body);
      const result = JSON.parse(response.body) as {
        data: {
          confirmationId: string;
          status: string;
          taskId: string | null;
          briefRevisionId: string | null;
        };
      };
      assert.equal(result.data.confirmationId, confirmation.id);
      assert.equal(result.data.status, 'approved');
      assert.equal(result.data.taskId, null);
      assert.ok(result.data.briefRevisionId);
      await assertConfirmationStatus(db, confirmation.id, 'approved');

      const afterCounts = await projectRowCounts(db, scenario.projectId);
      assert.deepEqual(afterCounts, beforeCounts);
    } finally {
      await cleanupScenario(db, scenario);
    }
  });

  it('Sales 项目成员拒绝确认时返回 403，且确认和现有任务保持不变', async () => {
    const scenario = await createScenario(db, 'sales', true);
    try {
      const confirmation = await createPendingConfirmation(db, scenario);
      const beforeCounts = await projectRowCounts(db, scenario.projectId);
      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/confirmations/${confirmation.id}/reject`,
        headers: authenticatedHeaders(scenario.sessionId),
        payload: { reason: 'Sales users cannot reject Agent confirmations.' },
      });

      assertForbidden(
        response.statusCode,
        response.body,
        'Only admin and designer roles can reject confirmations',
      );
      await assertConfirmationStatus(db, confirmation.id, 'pending');
      assert.deepEqual(
        await projectRowCounts(db, scenario.projectId),
        beforeCounts,
      );
    } finally {
      await cleanupScenario(db, scenario);
    }
  });
});

async function createScenario(
  db: Database,
  role: Role,
  addProjectMembership: boolean,
): Promise<Scenario> {
  const actorId = randomUUID();
  const customerId = randomUUID();
  const projectId = randomUUID();

  await db.insert(users).values({
    id: actorId,
    email: `issue-158-${actorId}@example.test`,
    displayName: `Issue 158 ${role}`,
    passwordHash: 'not-used-by-session-authentication',
    role,
    status: 'enabled',
  });
  await db.insert(customers).values({
    id: customerId,
    name: `Issue 158 Customer ${customerId}`,
    status: 'active',
    createdBy: actorId,
  });
  await db.insert(projects).values({
    id: projectId,
    name: `Issue 158 Project ${projectId}`,
    customerId,
    ownerId: actorId,
    status: 'designing',
    revision: 1,
  });
  if (addProjectMembership) {
    await db.insert(projectMembers).values({
      projectId,
      userId: actorId,
      addedBy: actorId,
    });
  }

  const sessionId = randomBytes(32).toString('hex');
  const now = new Date();
  await db.insert(sessions).values({
    tokenHash: createHash('sha256').update(sessionId).digest('hex'),
    userId: actorId,
    createdAt: now,
    expiresAt: new Date(now.getTime() + 60 * 60 * 1000),
    absoluteExpiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000),
  });

  return { actorId, customerId, projectId, sessionId };
}

async function cleanupScenario(
  db: Database,
  scenario: Scenario,
): Promise<void> {
  await cleanupProject(db, scenario.projectId);
  await db.delete(customers).where(eq(customers.id, scenario.customerId));
  await db.delete(users).where(eq(users.id, scenario.actorId));
}

function authenticatedHeaders(sessionId: string): Record<string, string> {
  return {
    cookie: `sessionId=${sessionId}`,
    'content-type': 'application/json',
    'x-csrf-token': deriveCsrfToken(sessionId),
  };
}

async function sendConversationMessage(scenario: Scenario) {
  return app.inject({
    method: 'POST',
    url: `/api/v1/projects/${scenario.projectId}/conversation/messages`,
    headers: authenticatedHeaders(scenario.sessionId),
    payload: {
      text: 'Start an Agent session for Issue #158 permission testing.',
      clientMessageId: testRunId(),
    },
  });
}

async function createPendingConfirmation(db: Database, scenario: Scenario) {
  const [conversation] = await db
    .insert(conversations)
    .values({ projectId: scenario.projectId })
    .returning();
  if (!conversation) throw new Error('Failed to create test conversation');

  const [task] = await db
    .insert(tasks)
    .values({
      projectId: scenario.projectId,
      kind: 'agent_run',
      status: 'pending',
      requestedBy: scenario.actorId,
    })
    .returning();
  if (!task) throw new Error('Failed to create test task');

  const [run] = await db
    .insert(agentRuns)
    .values({
      conversationId: conversation.id,
      projectId: scenario.projectId,
      taskId: task.id,
      status: 'pending',
    })
    .returning();
  if (!run) throw new Error('Failed to create test Agent run');

  const [confirmation] = await db
    .insert(confirmations)
    .values({
      runId: run.id,
      projectId: scenario.projectId,
      requestedBy: scenario.actorId,
      action: 'apply_brief_patch',
      payload: { patch: briefPatch },
      payloadHash: confirmationPayloadHash,
      status: 'pending',
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    })
    .returning();
  if (!confirmation) throw new Error('Failed to create test confirmation');

  return confirmation;
}

async function projectRowCounts(
  db: Database,
  projectId: string,
): Promise<ProjectRowCounts> {
  const [conversationCount] = await db
    .select({ value: count() })
    .from(conversations)
    .where(eq(conversations.projectId, projectId));
  const [messageCount] = await db
    .select({ value: count() })
    .from(messages)
    .innerJoin(conversations, eq(messages.conversationId, conversations.id))
    .where(eq(conversations.projectId, projectId));
  const [runCount] = await db
    .select({ value: count() })
    .from(agentRuns)
    .where(eq(agentRuns.projectId, projectId));
  const [taskCount] = await db
    .select({ value: count() })
    .from(tasks)
    .where(eq(tasks.projectId, projectId));

  return {
    conversations: conversationCount?.value ?? 0,
    messages: messageCount?.value ?? 0,
    runs: runCount?.value ?? 0,
    tasks: taskCount?.value ?? 0,
  };
}

async function assertConfirmationStatus(
  db: Database,
  confirmationId: string,
  expectedStatus: 'pending' | 'approved',
): Promise<void> {
  const [confirmation] = await db
    .select({ status: confirmations.status })
    .from(confirmations)
    .where(eq(confirmations.id, confirmationId));
  assert.equal(confirmation?.status, expectedStatus);
}

function assertForbidden(
  statusCode: number,
  body: string,
  expectedMessage: string,
): void {
  assert.equal(statusCode, 403, body);
  const payload = JSON.parse(body) as {
    error?: { code?: string; message?: string };
  };
  assert.equal(payload.error?.code, 'FORBIDDEN');
  assert.equal(payload.error?.message, expectedMessage);
}
