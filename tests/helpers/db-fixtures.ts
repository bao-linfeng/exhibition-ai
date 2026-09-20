import { randomUUID } from 'node:crypto';
import { eq, inArray } from 'drizzle-orm';
import type { Database } from '../../packages/db/src/index.js';
import {
  assets,
  briefRevisions,
  customers,
  designDirections,
  imageVersions,
  projects,
  tasks,
  usageLedger,
  users,
  type Asset,
  type BriefRevision,
  type Customer,
  type DesignDirectionRow,
  type ImageVersion,
  type Project,
  type Task,
  type User,
} from '../../packages/db/src/schema/index.js';

export async function insertTestUser(db: Database): Promise<User> {
  const [user] = await db
    .insert(users)
    .values({
      id: randomUUID(),
      email: `integration-${randomUUID()}@example.test`,
      displayName: 'Integration Test User',
      passwordHash: 'integration-test-password-hash',
      role: 'admin',
      status: 'enabled',
    })
    .returning();

  if (!user) throw new Error('Failed to create test user');
  return user;
}

export async function insertTestCustomer(
  db: Database,
  ownerId: string,
): Promise<Customer> {
  const [customer] = await db
    .insert(customers)
    .values({
      id: randomUUID(),
      name: `Integration Customer ${randomUUID()}`,
      status: 'active',
      createdBy: ownerId,
    })
    .returning();

  if (!customer) throw new Error('Failed to create test customer');
  return customer;
}

export async function insertTestProject(
  db: Database,
  customerId: string,
  ownerId: string,
): Promise<Project> {
  const [project] = await db
    .insert(projects)
    .values({
      id: randomUUID(),
      name: `Integration Project ${randomUUID()}`,
      customerId,
      ownerId,
      status: 'designing',
      revision: 1,
    })
    .returning();

  if (!project) throw new Error('Failed to create test project');
  return project;
}

export async function insertTestTask(
  db: Database,
  projectId: string,
  requestedBy: string,
): Promise<Task> {
  const [task] = await db
    .insert(tasks)
    .values({
      id: randomUUID(),
      projectId,
      kind: 'image_generation',
      status: 'pending',
      requestedBy,
    })
    .returning();

  if (!task) throw new Error('Failed to create test task');
  return task;
}

export async function insertTestAsset(
  db: Database,
  projectId: string,
  createdBy: string,
): Promise<Asset> {
  const id = randomUUID();
  const [asset] = await db
    .insert(assets)
    .values({
      id,
      projectId,
      kind: 'generated_image',
      status: 'ready',
      bucket: 'exhibition-dev',
      objectKey: `integration/${id}.png`,
      originalFilename: `${id}.png`,
      mimeType: 'image/png',
      sizeBytes: 1024,
      width: 1280,
      height: 720,
      createdBy,
    })
    .returning();

  if (!asset) throw new Error('Failed to create test asset');
  return asset;
}

export async function insertTestBriefRevision(
  db: Database,
  projectId: string,
  createdBy: string,
): Promise<BriefRevision> {
  const [brief] = await db
    .insert(briefRevisions)
    .values({
      id: randomUUID(),
      projectId,
      number: 1,
      content: {
        title: 'Integration Test Brief',
        description: 'Test brief for integration tests',
      },
      createdBy,
      confirmedBy: createdBy,
      confirmedAt: new Date(),
    })
    .returning();

  if (!brief) throw new Error('Failed to create test brief revision');
  return brief;
}

export async function insertTestDesignDirection(
  db: Database,
  projectId: string,
  briefRevisionId: string,
  taskId: string,
  createdBy: string,
): Promise<DesignDirectionRow> {
  const [direction] = await db
    .insert(designDirections)
    .values({
      id: randomUUID(),
      projectId,
      briefRevisionId,
      sourceTaskId: taskId,
      title: 'Integration Test Direction',
      concept: 'Test concept',
      layoutDescription: 'Test layout',
      materialsAndColors: 'Test materials',
      constraintsChecklist: [],
      createdBy,
    })
    .returning();

  if (!direction) throw new Error('Failed to create test design direction');
  return direction;
}

export async function insertTestImageVersion(
  db: Database,
  projectId: string,
  taskId: string,
  assetId: string,
  briefRevisionId: string,
  createdBy: string,
): Promise<ImageVersion> {
  const [imageVersion] = await db
    .insert(imageVersions)
    .values({
      id: randomUUID(),
      projectId,
      taskId,
      outputOrdinal: 0,
      assetId,
      sequence: 1,
      briefRevisionId,
      width: 1280,
      height: 720,
      sizeBytes: 1024,
      mimeType: 'image/png',
      createdBy,
    })
    .returning();

  if (!imageVersion) throw new Error('Failed to create test image version');
  return imageVersion;
}

export async function cleanupProject(
  db: Database,
  projectId: string,
): Promise<void> {
  const projectTaskIds = db
    .select({ id: tasks.id })
    .from(tasks)
    .where(eq(tasks.projectId, projectId));

  await db
    .delete(usageLedger)
    .where(inArray(usageLedger.taskId, projectTaskIds));
  await db.delete(projects).where(eq(projects.id, projectId));
}
