import type {
  CreateProjectRequest,
  Project as ProjectContract,
  ProjectMember,
  ProjectSummary,
  UpdateProjectRequest,
} from '@exhibition/contracts';
import type { Project as DbProject } from '@exhibition/db';
import {
  ProjectRepository,
  type ProjectMemberWithUser,
  type ProjectWithNames,
} from './projects.repository.js';

export class ProjectService {
  constructor(private repo: ProjectRepository) {}

  async listProjects(query: {
    status?: DbProject['status'];
    customerId?: string;
    ownerId?: string;
    search?: string;
    cursor?: string;
    limit?: number;
  }): Promise<{
    data: ProjectSummary[];
    page: { nextCursor: string | null; hasMore: boolean };
  }> {
    const result = await this.repo.findAll(query);
    return {
      data: result.data.map((project) => this.toSummary(project)),
      page: result.page,
    };
  }

  async createProject(
    data: CreateProjectRequest,
    requestedBy: string,
  ): Promise<ProjectContract> {
    const project = await this.repo.create(data);
    await this.repo.addMember(project.id, data.ownerId, requestedBy);
    return this.toProject(project);
  }

  async getProject(id: string): Promise<ProjectContract | null> {
    const project = await this.repo.findById(id);
    return project ? this.toProject(project) : null;
  }

  async updateProject(
    id: string,
    data: UpdateProjectRequest,
    expectedRevision: number,
  ): Promise<ProjectContract | null | 'conflict'> {
    const project = await this.repo.update(
      id,
      {
        name: data.name,
        ownerId: data.ownerId,
        exhibitionName: data.exhibitionName,
        exhibitionVenue: data.exhibitionVenue,
        boothNumber: data.boothNumber,
        exhibitionDate: data.exhibitionDate,
        deliveryDeadline: data.deliveryDeadline,
        industry: data.industry,
        notes: data.notes,
      },
      expectedRevision,
    );
    if (project) return this.toProject(project);
    return (await this.repo.findById(id)) ? 'conflict' : null;
  }

  async listMembers(projectId: string): Promise<ProjectMember[]> {
    return (await this.repo.findMembers(projectId)).map((member) =>
      this.toMember(member),
    );
  }

  async addMember(
    projectId: string,
    userId: string,
    addedBy: string,
  ): Promise<ProjectMember | null> {
    const created = await this.repo.addMember(projectId, userId, addedBy);
    if (!created) return null;
    return (
      (await this.repo.findMembers(projectId))
        .map((member) => this.toMember(member))
        .find((member) => member.userId === userId) ?? null
    );
  }

  async removeMember(projectId: string, userId: string): Promise<void> {
    await this.repo.removeMember(projectId, userId);
  }

  async transferOwner(
    projectId: string,
    newOwnerId: string,
    expectedRevision: number,
  ): Promise<ProjectContract | null | 'conflict'> {
    const project = await this.repo.updateOwner(
      projectId,
      newOwnerId,
      expectedRevision,
    );
    if (project) return this.toProject(project);
    return (await this.repo.findById(projectId)) ? 'conflict' : null;
  }

  async transitionArchive(
    projectId: string,
    action: 'archive' | 'restore',
    expectedRevision: number,
  ): Promise<ProjectContract | null | 'conflict'> {
    const existing = await this.repo.findById(projectId);
    if (!existing) return null;
    const update =
      action === 'archive'
        ? { status: 'archived' as const, archivedFromStatus: existing.status }
        : {
            status: existing.archivedFromStatus ?? 'draft',
            archivedFromStatus: null,
          };
    const project = await this.repo.update(projectId, update, expectedRevision);
    return project ? this.toProject(project) : 'conflict';
  }

  private toSummary(project: ProjectWithNames): ProjectSummary {
    return {
      id: project.id,
      name: project.name,
      customerId: project.customerId,
      customerName: project.customerName,
      ownerId: project.ownerId,
      ownerName: project.ownerName,
      status: project.status,
      ...(project.exhibitionName
        ? { exhibitionName: project.exhibitionName }
        : {}),
      ...(project.exhibitionDate
        ? { exhibitionDate: project.exhibitionDate }
        : {}),
      ...(project.deliveryDeadline
        ? { deliveryDeadline: project.deliveryDeadline }
        : {}),
      createdAt: project.createdAt.toISOString(),
      updatedAt: project.updatedAt.toISOString(),
    };
  }

  private toProject(project: ProjectWithNames): ProjectContract {
    return {
      ...this.toSummary(project),
      archivedFromStatus: project.archivedFromStatus,
      ...(project.exhibitionVenue
        ? { exhibitionVenue: project.exhibitionVenue }
        : {}),
      ...(project.boothNumber ? { boothNumber: project.boothNumber } : {}),
      ...(project.industry ? { industry: project.industry } : {}),
      ...(project.notes ? { notes: project.notes } : {}),
      currentBriefRevisionId: project.currentBriefRevisionId,
      selectedVersionId: project.selectedVersionId,
      nextVersionSequence: project.nextVersionSequence,
      nextEventSequence: project.nextEventSequence,
      revision: project.revision,
    };
  }

  private toMember(member: ProjectMemberWithUser): ProjectMember {
    return {
      ...member,
      userRole: member.userRole as ProjectMember['userRole'],
      addedAt: member.addedAt.toISOString(),
    };
  }
}
