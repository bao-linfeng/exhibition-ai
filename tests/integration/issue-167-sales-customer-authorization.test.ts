import assert from 'node:assert/strict';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import { eq } from 'drizzle-orm';
import {
  createServices,
  initDatabase,
  type Services,
} from '../../packages/backend/src/index.js';
import type { Database } from '../../packages/db/src/index.js';
import {
  customers,
  projectMembers,
  projects,
  sessions,
  users,
} from '../../packages/db/src/schema/index.js';
import { buildApp } from '../../apps/api/src/app.js';
import { deriveCsrfToken } from '../../apps/api/src/plugins/csrf.js';

type Role = 'admin' | 'designer' | 'sales' | 'viewer';

interface TestUser {
  id: string;
  role: Role;
  sessionId: string;
}

interface TestCustomer {
  id: string;
  createdBy: string;
}

interface TestProject {
  id: string;
  customerId: string;
  ownerId: string;
}

let app: Awaited<ReturnType<typeof buildApp>>;

describe('Issue #167: Sales 用户客户访问权限控制', () => {
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

  it('Sales 用户不能列出无关客户（非自己创建且未参与关联项目）', async () => {
    const admin = await createUser(db, 'admin');
    const sales = await createUser(db, 'sales');

    // Admin 创建的客户，Sales 未参与任何关联项目
    const customer = await createCustomer(db, admin.id);

    try {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/customers',
        headers: authenticatedHeaders(sales.sessionId),
      });

      assert.equal(response.statusCode, 200, response.body);
      const result = JSON.parse(response.body) as {
        data: Array<{ id: string }>;
      };

      // Sales 用户不应该看到这个客户
      const customerIds = result.data.map((c) => c.id);
      assert.ok(
        !customerIds.includes(customer.id),
        'Sales user should not see unrelated customer',
      );
    } finally {
      await cleanup(db, { users: [admin, sales], customers: [customer] });
    }
  });

  it('Sales 用户能列出自己创建的客户', async () => {
    const sales = await createUser(db, 'sales');
    const customer = await createCustomer(db, sales.id);

    try {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/customers',
        headers: authenticatedHeaders(sales.sessionId),
      });

      assert.equal(response.statusCode, 200, response.body);
      const result = JSON.parse(response.body) as {
        data: Array<{ id: string }>;
      };

      // Sales 用户应该能看到自己创建的客户
      const customerIds = result.data.map((c) => c.id);
      assert.ok(
        customerIds.includes(customer.id),
        'Sales user should see their own customer',
      );
    } finally {
      await cleanup(db, { users: [sales], customers: [customer] });
    }
  });

  it('Sales 用户能列出与其参与项目关联的客户', async () => {
    const admin = await createUser(db, 'admin');
    const sales = await createUser(db, 'sales');

    // Admin 创建客户和项目
    const customer = await createCustomer(db, admin.id);
    const project = await createProject(db, customer.id, admin.id);

    // 将 Sales 用户添加为项目成员
    await addProjectMember(db, project.id, sales.id, admin.id);

    try {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/customers',
        headers: authenticatedHeaders(sales.sessionId),
      });

      assert.equal(response.statusCode, 200, response.body);
      const result = JSON.parse(response.body) as {
        data: Array<{ id: string }>;
      };

      // Sales 用户应该能看到与其参与项目关联的客户
      const customerIds = result.data.map((c) => c.id);
      assert.ok(
        customerIds.includes(customer.id),
        'Sales user should see customer associated with their project',
      );
    } finally {
      await cleanup(db, {
        users: [admin, sales],
        customers: [customer],
        projects: [project],
      });
    }
  });

  it('Sales 用户不能获取无关客户详情', async () => {
    const admin = await createUser(db, 'admin');
    const sales = await createUser(db, 'sales');
    const customer = await createCustomer(db, admin.id);

    try {
      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/customers/${customer.id}`,
        headers: authenticatedHeaders(sales.sessionId),
      });

      // 应该返回 404（不泄露资源是否存在）或 403
      assert.ok(
        response.statusCode === 404 || response.statusCode === 403,
        `Expected 404 or 403, got ${response.statusCode}`,
      );
    } finally {
      await cleanup(db, { users: [admin, sales], customers: [customer] });
    }
  });

  it('Sales 用户能获取自己创建的客户详情', async () => {
    const sales = await createUser(db, 'sales');
    const customer = await createCustomer(db, sales.id);

    try {
      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/customers/${customer.id}`,
        headers: authenticatedHeaders(sales.sessionId),
      });

      assert.equal(response.statusCode, 200, response.body);
      const result = JSON.parse(response.body) as {
        data: { id: string; createdBy: string };
      };
      assert.equal(result.data.id, customer.id);
      assert.equal(result.data.createdBy, sales.id);
    } finally {
      await cleanup(db, { users: [sales], customers: [customer] });
    }
  });

  it('Sales 用户不能修改无关客户', async () => {
    const admin = await createUser(db, 'admin');
    const sales = await createUser(db, 'sales');
    const customer = await createCustomer(db, admin.id);

    try {
      const response = await app.inject({
        method: 'PATCH',
        url: `/api/v1/customers/${customer.id}`,
        headers: authenticatedHeaders(sales.sessionId),
        payload: {
          name: 'Unauthorized Update Attempt',
          expectedRevision: 1,
        },
      });

      // 应该返回 403（forbidden）
      assert.equal(response.statusCode, 403, response.body);

      // 验证客户信息未被修改
      const [unchanged] = await db
        .select()
        .from(customers)
        .where(eq(customers.id, customer.id));
      assert.notEqual(unchanged?.name, 'Unauthorized Update Attempt');
    } finally {
      await cleanup(db, { users: [admin, sales], customers: [customer] });
    }
  });

  it('Sales 用户能修改与其参与项目关联的客户', async () => {
    const admin = await createUser(db, 'admin');
    const sales = await createUser(db, 'sales');

    const customer = await createCustomer(db, admin.id);
    const project = await createProject(db, customer.id, admin.id);
    await addProjectMember(db, project.id, sales.id, admin.id);

    try {
      const response = await app.inject({
        method: 'PATCH',
        url: `/api/v1/customers/${customer.id}`,
        headers: authenticatedHeaders(sales.sessionId),
        payload: {
          name: 'Updated by Sales User',
          expectedRevision: 1,
        },
      });

      assert.equal(response.statusCode, 200, response.body);
      const result = JSON.parse(response.body) as {
        data: { id: string; name: string; revision: number };
      };
      assert.equal(result.data.id, customer.id);
      assert.equal(result.data.name, 'Updated by Sales User');
      assert.equal(result.data.revision, 2);
    } finally {
      await cleanup(db, {
        users: [admin, sales],
        customers: [customer],
        projects: [project],
      });
    }
  });

  it('Admin 用户能访问和修改所有客户（不受项目成员限制）', async () => {
    const sales = await createUser(db, 'sales');
    const admin = await createUser(db, 'admin');

    // Sales 创建的客户，Admin 未参与任何关联项目
    const customer = await createCustomer(db, sales.id);

    try {
      // Admin 能列出
      const listResponse = await app.inject({
        method: 'GET',
        url: '/api/v1/customers',
        headers: authenticatedHeaders(admin.sessionId),
      });
      assert.equal(listResponse.statusCode, 200);
      const listResult = JSON.parse(listResponse.body) as {
        data: Array<{ id: string }>;
      };
      const customerIds = listResult.data.map((c) => c.id);
      assert.ok(
        customerIds.includes(customer.id),
        'Admin should see all customers',
      );

      // Admin 能获取详情
      const getResponse = await app.inject({
        method: 'GET',
        url: `/api/v1/customers/${customer.id}`,
        headers: authenticatedHeaders(admin.sessionId),
      });
      assert.equal(getResponse.statusCode, 200);

      // Admin 能修改
      const patchResponse = await app.inject({
        method: 'PATCH',
        url: `/api/v1/customers/${customer.id}`,
        headers: authenticatedHeaders(admin.sessionId),
        payload: {
          name: 'Updated by Admin',
          expectedRevision: 1,
        },
      });
      assert.equal(patchResponse.statusCode, 200);
      const patchResult = JSON.parse(patchResponse.body) as {
        data: { name: string };
      };
      assert.equal(patchResult.data.name, 'Updated by Admin');
    } finally {
      await cleanup(db, { users: [sales, admin], customers: [customer] });
    }
  });

  it('Designer 用户受相同项目成员范围限制', async () => {
    const admin = await createUser(db, 'admin');
    const designer = await createUser(db, 'designer');

    // Admin 创建的客户，Designer 未参与任何关联项目
    const customer = await createCustomer(db, admin.id);

    try {
      // Designer 不能列出
      const listResponse = await app.inject({
        method: 'GET',
        url: '/api/v1/customers',
        headers: authenticatedHeaders(designer.sessionId),
      });
      assert.equal(listResponse.statusCode, 200);
      const listResult = JSON.parse(listResponse.body) as {
        data: Array<{ id: string }>;
      };
      const customerIds = listResult.data.map((c) => c.id);
      assert.ok(
        !customerIds.includes(customer.id),
        'Designer should not see unrelated customer',
      );

      // Designer 不能获取详情（返回 404 或 403）
      const getResponse = await app.inject({
        method: 'GET',
        url: `/api/v1/customers/${customer.id}`,
        headers: authenticatedHeaders(designer.sessionId),
      });
      assert.ok(
        getResponse.statusCode === 404 || getResponse.statusCode === 403,
        `Expected 404 or 403, got ${getResponse.statusCode}`,
      );
    } finally {
      await cleanup(db, { users: [admin, designer], customers: [customer] });
    }
  });

  it('Viewer 用户受相同项目成员范围限制', async () => {
    const admin = await createUser(db, 'admin');
    const viewer = await createUser(db, 'viewer');

    // Admin 创建的客户，Viewer 未参与任何关联项目
    const customer = await createCustomer(db, admin.id);

    try {
      // Viewer 不能列出
      const listResponse = await app.inject({
        method: 'GET',
        url: '/api/v1/customers',
        headers: authenticatedHeaders(viewer.sessionId),
      });
      assert.equal(listResponse.statusCode, 200);
      const listResult = JSON.parse(listResponse.body) as {
        data: Array<{ id: string }>;
      };
      const customerIds = listResult.data.map((c) => c.id);
      assert.ok(
        !customerIds.includes(customer.id),
        'Viewer should not see unrelated customer',
      );

      // Viewer 不能获取详情（返回 404 或 403）
      const getResponse = await app.inject({
        method: 'GET',
        url: `/api/v1/customers/${customer.id}`,
        headers: authenticatedHeaders(viewer.sessionId),
      });
      assert.ok(
        getResponse.statusCode === 404 || getResponse.statusCode === 403,
        `Expected 404 or 403, got ${getResponse.statusCode}`,
      );
    } finally {
      await cleanup(db, { users: [admin, viewer], customers: [customer] });
    }
  });
});

async function createUser(db: Database, role: Role): Promise<TestUser> {
  const userId = randomUUID();
  await db.insert(users).values({
    id: userId,
    email: `issue-167-${userId}@example.test`,
    displayName: `Issue 167 ${role}`,
    passwordHash: 'not-used-by-session-authentication',
    role,
    status: 'enabled',
  });

  const sessionId = randomBytes(32).toString('hex');
  const now = new Date();
  await db.insert(sessions).values({
    tokenHash: createHash('sha256').update(sessionId).digest('hex'),
    userId,
    createdAt: now,
    expiresAt: new Date(now.getTime() + 60 * 60 * 1000),
    absoluteExpiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000),
  });

  return { id: userId, role, sessionId };
}

async function createCustomer(
  db: Database,
  createdBy: string,
): Promise<TestCustomer> {
  const customerId = randomUUID();
  await db.insert(customers).values({
    id: customerId,
    name: `Issue 167 Customer ${customerId.slice(0, 8)}`,
    status: 'active',
    createdBy,
  });

  return { id: customerId, createdBy };
}

async function createProject(
  db: Database,
  customerId: string,
  ownerId: string,
): Promise<TestProject> {
  const projectId = randomUUID();
  await db.insert(projects).values({
    id: projectId,
    name: `Issue 167 Project ${projectId.slice(0, 8)}`,
    customerId,
    ownerId,
    status: 'designing',
    revision: 1,
  });

  return { id: projectId, customerId, ownerId };
}

async function addProjectMember(
  db: Database,
  projectId: string,
  userId: string,
  addedBy: string,
): Promise<void> {
  await db.insert(projectMembers).values({
    projectId,
    userId,
    addedBy,
  });
}

function authenticatedHeaders(sessionId: string): Record<string, string> {
  return {
    cookie: `sessionId=${sessionId}`,
    'content-type': 'application/json',
    'x-csrf-token': deriveCsrfToken(sessionId),
  };
}

interface CleanupResources {
  users?: TestUser[];
  customers?: TestCustomer[];
  projects?: TestProject[];
}

async function cleanup(
  db: Database,
  resources: CleanupResources,
): Promise<void> {
  // 删除顺序：projects -> customers -> sessions/users
  if (resources.projects) {
    for (const project of resources.projects) {
      await db
        .delete(projectMembers)
        .where(eq(projectMembers.projectId, project.id));
      await db.delete(projects).where(eq(projects.id, project.id));
    }
  }

  if (resources.customers) {
    for (const customer of resources.customers) {
      await db.delete(customers).where(eq(customers.id, customer.id));
    }
  }

  if (resources.users) {
    for (const user of resources.users) {
      const tokenHash = createHash('sha256')
        .update(user.sessionId)
        .digest('hex');
      await db.delete(sessions).where(eq(sessions.tokenHash, tokenHash));
      await db.delete(users).where(eq(users.id, user.id));
    }
  }
}
