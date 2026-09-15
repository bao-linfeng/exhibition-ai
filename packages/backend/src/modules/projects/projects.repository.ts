import { and, desc, eq, ilike, lt, sql } from 'drizzle-orm';
import type { Database, NewProject, Project } from '@exhibition/db';
import { customers, projectMembers, projects, users } from '@exhibition/db';

export interface ProjectWithNames extends Project {
  customerName: string;
  ownerName: string;
}

export interface ProjectMemberWithUser {
  userId: string;
  userName: string;
  userEmail: string;
  userRole: string;
  addedBy: string;
  addedAt: Date;
}

export interface ProjectListOptions {
  status?: Project['status'];
  customerId?: string;
  ownerId?: string;
  memberId?: string;
  search?: string;
  cursor?: string;
  limit?: number;
}

const projectColumns = {
  id: projects.id,
  name: projects.name,
  customerId: projects.customerId,
  ownerId: projects.ownerId,
  status: projects.status,
  archivedFromStatus: projects.archivedFromStatus,
  exhibitionName: projects.exhibitionName,
  exhibitionVenue: projects.exhibitionVenue,
  boothNumber: projects.boothNumber,
  exhibitionDate: projects.exhibitionDate,
  deliveryDeadline: projects.deliveryDeadline,
  industry: projects.industry,
  notes: projects.notes,
  currentBriefRevisionId: projects.currentBriefRevisionId,
  selectedVersionId: projects.selectedVersionId,
  nextVersionSequence: projects.nextVersionSequence,
  nextEventSequence: projects.nextEventSequence,
  createdAt: projects.createdAt,
  updatedAt: projects.updatedAt,
  revision: projects.revision,
  customerName: customers.name,
  ownerName: users.displayName,
};

export class ProjectRepository {
  constructor(private db: Database) {}

  async findAll(options: ProjectListOptions): Promise<{
    data: ProjectWithNames[];
    page: { nextCursor: string | null; hasMore: boolean };
  }> {
    const limit = Math.min(Math.max(options.limit ?? 20, 1), 100);

    const rows = await this.db
      .select(projectColumns)
      .from(projects)
      .innerJoin(customers, eq(projects.customerId, customers.id))
      .innerJoin(users, eq(projects.ownerId, users.id))
      .where(
        and(
          options.status ? eq(projects.status, options.status) : undefined,
          options.customerId
            ? eq(projects.customerId, options.customerId)
            : undefined,
          options.ownerId ? eq(projects.ownerId, options.ownerId) : undefined,
          options.memberId
            ? sql`exists (select 1 from ${projectMembers} where ${projectMembers.projectId} = ${projects.id} and ${projectMembers.userId} = ${options.memberId})`
            : undefined,
          options.search
            ? ilike(projects.name, `%${options.search}%`)
            : undefined,
          options.cursor
            ? lt(projects.createdAt, new Date(options.cursor))
            : undefined,
        ),
      )
      .orderBy(desc(projects.createdAt), desc(projects.id))
      .limit(limit + 1);

    const hasMore = rows.length > limit;
    const data = hasMore ? rows.slice(0, limit) : rows;
    const last = data.at(-1);

    return {
      data,
      page: {
        hasMore,
        nextCursor: hasMore && last ? last.createdAt.toISOString() : null,
      },
    };
  }

  async findById(id: string): Promise<ProjectWithNames | undefined> {
    const [project] = await this.db
      .select(projectColumns)
      .from(projects)
      .innerJoin(customers, eq(projects.customerId, customers.id))
      .innerJoin(users, eq(projects.ownerId, users.id))
      .where(eq(projects.id, id))
      .limit(1);

    return project;
  }

  async create(data: NewProject): Promise<ProjectWithNames> {
    const [project] = await this.db
      .insert(projects)
      .values(data)
      .returning({ id: projects.id });

    if (!project) throw new Error('Project creation did not return a row');

    const result = await this.findById(project.id);
    if (!result) throw new Error('Created project could not be loaded');

    return result;
  }

  async update(
    id: string,
    data: Partial<
      Omit<NewProject, 'id' | 'createdAt' | 'updatedAt' | 'revision'>
    >,
    expectedRevision: number,
  ): Promise<ProjectWithNames | null> {
    const [project] = await this.db
      .update(projects)
      .set({
        ...data,
        updatedAt: new Date(),
        revision: sql`${projects.revision} + 1`,
      })
      .where(and(eq(projects.id, id), eq(projects.revision, expectedRevision)))
      .returning({ id: projects.id });

    return project ? ((await this.findById(project.id)) ?? null) : null;
  }

  async findMembers(projectId: string): Promise<ProjectMemberWithUser[]> {
    return this.db
      .select({
        userId: projectMembers.userId,
        userName: users.displayName,
        userEmail: users.email,
        userRole: users.role,
        addedBy: projectMembers.addedBy,
        addedAt: projectMembers.addedAt,
      })
      .from(projectMembers)
      .innerJoin(users, eq(projectMembers.userId, users.id))
      .where(eq(projectMembers.projectId, projectId))
      .orderBy(users.displayName);
  }

  async isMember(projectId: string, userId: string): Promise<boolean> {
    const [member] = await this.db
      .select({ userId: projectMembers.userId })
      .from(projectMembers)
      .where(
        and(
          eq(projectMembers.projectId, projectId),
          eq(projectMembers.userId, userId),
        ),
      )
      .limit(1);

    return member !== undefined;
  }

  async addMember(
    projectId: string,
    userId: string,
    addedBy: string,
  ): Promise<boolean> {
    const rows = await this.db
      .insert(projectMembers)
      .values({ projectId, userId, addedBy })
      .onConflictDoNothing()
      .returning({ userId: projectMembers.userId });

    return rows.length > 0;
  }

  async removeMember(projectId: string, userId: string): Promise<void> {
    await this.db
      .delete(projectMembers)
      .where(
        and(
          eq(projectMembers.projectId, projectId),
          eq(projectMembers.userId, userId),
        ),
      );
  }

  async updateOwner(
    projectId: string,
    newOwnerId: string,
    expectedRevision: number,
  ): Promise<ProjectWithNames | null> {
    return this.update(projectId, { ownerId: newOwnerId }, expectedRevision);
  }
}
