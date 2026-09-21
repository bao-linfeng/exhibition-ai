import type {
  CreateProjectRequest,
  Project as ProjectContract,
  ProjectMember,
  ProjectSummary,
  UpdateProjectRequest,
} from '@exhibition/contracts';
import type { NewProject, Project as DbProject } from '@exhibition/db';
import {
  ProjectRepository,
  type ProjectMemberWithUser,
  type ProjectWithNames,
} from './projects.repository.js';
import type { EventsService } from '../events/events.service.js';
import type { AuditService } from '../audit/audit.service.js';
import type { UserRepository } from '../users/users.repository.js';
import type { ConversationService } from '../conversations/conversations.service.js';

export class ProjectService {
  constructor(
    private repo: ProjectRepository,
    private eventsService: EventsService,
    private auditService: AuditService,
    private userRepo: UserRepository,
    private conversationService: ConversationService,
  ) {}

  async listProjects(
    query: {
      status?: DbProject['status'];
      customerId?: string;
      ownerId?: string;
      search?: string;
      cursor?: string;
      limit?: number;
    },
    requestingUser: { id: string; role: string },
  ): Promise<
    | {
        data: ProjectSummary[];
        page: { nextCursor: string | null; hasMore: boolean };
      }
    | 'forbidden'
  > {
    if (!['admin', 'designer', 'sales', 'viewer'].includes(requestingUser.role))
      return 'forbidden';

    const result = await this.repo.findAll({
      ...query,
      ...(requestingUser.role === 'admin'
        ? {}
        : { memberId: requestingUser.id }),
    });

    return {
      data: result.data.map((project) => this.toSummary(project)),
      page: result.page,
    };
  }

  async createProject(
    data: CreateProjectRequest,
    requestedBy: string,
    requestingUser: { id: string; role: string },
  ): Promise<ProjectContract | 'forbidden' | null> {
    if (!['admin', 'designer', 'sales'].includes(requestingUser.role))
      return 'forbidden';

    const ownerValidation = await this.validateProjectOwner(data.ownerId);
    if (ownerValidation !== true)
      return ownerValidation === 'invalid_user' ? null : 'forbidden';

    const project = await this.repo.create(data);
    await this.repo.addMember(project.id, data.ownerId, requestedBy);

    // 发布项目创建事件
    await this.eventsService.appendEvent(
      project.id,
      {
        type: 'project.created',
        data: {
          projectId: project.id,
          name: project.name,
          customerId: project.customerId,
          ownerId: project.ownerId,
        },
      },
      { userId: requestedBy, role: requestingUser.role },
    );

    return this.toProject(project);
  }

  async getProject(
    id: string,
    requestingUser: { id: string; role: string },
  ): Promise<ProjectContract | null | 'forbidden'> {
    if (!['admin', 'designer', 'sales', 'viewer'].includes(requestingUser.role))
      return 'forbidden';

    const project = await this.repo.findById(id);
    if (
      project &&
      requestingUser.role !== 'admin' &&
      !(await this.repo.isMember(id, requestingUser.id))
    ) {
      return null;
    }

    return project ? this.toProject(project) : null;
  }

  async listVisibleProjectIds(userId: string): Promise<string[]> {
    return this.repo.findMemberProjectIds(userId);
  }

  async updateProject(
    id: string,
    data: UpdateProjectRequest,
    expectedRevision: number,
    requestingUser: { id: string; role: string },
  ): Promise<ProjectContract | null | 'conflict' | 'forbidden'> {
    const existing = await this.repo.findById(id);
    if (!existing) return null;

    if (requestingUser.role === 'viewer') return 'forbidden';

    // 写锁：reviewing/approved/archived 状态禁止元数据修改
    if (['reviewing', 'approved', 'archived'].includes(existing.status)) {
      return 'forbidden';
    }

    if (requestingUser.role !== 'admin') {
      if (!(await this.repo.isMember(id, requestingUser.id))) return null;

      if (
        (requestingUser.role === 'sales' &&
          existing.ownerId !== requestingUser.id) ||
        (data.ownerId !== undefined && data.ownerId !== existing.ownerId)
      ) {
        return 'forbidden';
      }
    }

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

    if (project) {
      // 发布项目更新事件
      await this.eventsService.appendEvent(
        id,
        {
          type: 'project.updated',
          data: {
            projectId: id,
            changes: data,
          },
          resourceId: id,
          resourceRevision: project.revision,
        },
        { userId: requestingUser.id, role: requestingUser.role },
      );

      return this.toProject(project);
    }
    return (await this.repo.findById(id)) ? 'conflict' : null;
  }

  async listMembers(
    projectId: string,
    requestingUser: { id: string; role: string },
  ): Promise<ProjectMember[] | null | 'forbidden'> {
    const project = await this.getProject(projectId, requestingUser);
    if (!project || project === 'forbidden') return project;

    return (await this.repo.findMembers(projectId)).map((member) =>
      this.toMember(member),
    );
  }

  async addMember(
    projectId: string,
    userId: string,
    addedBy: string,
    requestingUser: { id: string; role: string },
  ): Promise<ProjectMember | null | 'forbidden'> {
    const project = await this.repo.findById(projectId);
    if (!project) return null;

    if (requestingUser.role !== 'admin') {
      if (!(await this.repo.isMember(projectId, requestingUser.id))) {
        return null;
      }
      if (project.ownerId !== requestingUser.id) return 'forbidden';
    }

    const created = await this.repo.addMember(projectId, userId, addedBy);
    if (!created) return null;

    await this.auditService.log({
      eventType: 'project.member_added',
      actorId: requestingUser.id,
      projectId,
      resourceType: 'project_member',
      resourceId: `${projectId}:${userId}`,
      metadata: {
        projectId,
        userId,
        addedBy,
      },
    });

    return (
      (await this.repo.findMembers(projectId))
        .map((member) => this.toMember(member))
        .find((member) => member.userId === userId) ?? null
    );
  }

  async removeMember(
    projectId: string,
    userId: string,
    requestingUser: { id: string; role: string },
  ): Promise<void | null | 'forbidden'> {
    const project = await this.repo.findById(projectId);
    if (!project) return null;

    if (requestingUser.role !== 'admin') {
      if (!(await this.repo.isMember(projectId, requestingUser.id))) {
        return null;
      }
      if (project.ownerId !== requestingUser.id) return 'forbidden';
    }

    if (userId === project.ownerId) return 'forbidden';

    await this.repo.removeMember(projectId, userId);
    await this.conversationService.expireConfirmationsForUser(
      userId,
      projectId,
      'AUTHORIZATION_REVOKED',
    );

    await this.auditService.log({
      eventType: 'project.member_removed',
      actorId: requestingUser.id,
      projectId,
      resourceType: 'project_member',
      resourceId: `${projectId}:${userId}`,
      metadata: {
        projectId,
        userId,
      },
    });
  }

  async transferOwner(
    projectId: string,
    newOwnerId: string,
    expectedRevision: number,
    requestingUser: { id: string; role: string },
  ): Promise<ProjectContract | null | 'conflict' | 'forbidden'> {
    const project = await this.repo.findById(projectId);
    if (!project) return null;

    if (requestingUser.role !== 'admin') {
      if (!(await this.repo.isMember(projectId, requestingUser.id))) {
        return null;
      }
      if (project.ownerId !== requestingUser.id) return 'forbidden';
    }

    const ownerValidation = await this.validateProjectOwner(newOwnerId);
    if (ownerValidation !== true)
      return ownerValidation === 'invalid_user' ? null : 'forbidden';

    const isMember = await this.repo.isMember(projectId, newOwnerId);
    if (!isMember) {
      await this.repo.addMember(projectId, newOwnerId, requestingUser.id);
    }

    const updatedProject = await this.repo.updateOwner(
      projectId,
      newOwnerId,
      expectedRevision,
    );

    if (updatedProject) {
      await this.auditService.log({
        eventType: 'project.owner_transferred',
        actorId: requestingUser.id,
        projectId,
        resourceType: 'project',
        resourceId: projectId,
        metadata: {
          projectId,
          previousOwnerId: project.ownerId,
          newOwnerId,
        },
      });
      return this.toProject(updatedProject);
    }
    return (await this.repo.findById(projectId)) ? 'conflict' : null;
  }

  private async validateProjectOwner(
    userId: string,
  ): Promise<'invalid_user' | 'forbidden_role' | true> {
    const user = await this.userRepo.findById(userId);
    if (!user || user.status !== 'enabled') return 'invalid_user';
    if (!['admin', 'designer', 'sales'].includes(user.role)) {
      return 'forbidden_role';
    }
    return true;
  }

  async transitionLifecycle(
    projectId: string,
    action: 'start_briefing' | 'start_designing',
    expectedRevision: number,
    requestingUser: { id: string; role: string },
  ): Promise<
    ProjectContract | null | 'conflict' | 'forbidden' | 'invalid_transition'
  > {
    if (!['admin', 'sales', 'designer'].includes(requestingUser.role))
      return 'forbidden';

    const existing = await this.repo.findById(projectId);
    if (!existing) return null;

    if (
      requestingUser.role !== 'admin' &&
      !(await this.repo.isMember(projectId, requestingUser.id))
    ) {
      return null;
    }

    if (action === 'start_briefing') {
      if (existing.status !== 'draft') return 'invalid_transition';
    } else {
      // start_designing
      if (existing.status !== 'briefing') return 'invalid_transition';
    }

    const newStatus = action === 'start_briefing' ? 'briefing' : 'designing';
    const project = await this.repo.update(
      projectId,
      { status: newStatus },
      expectedRevision,
    );

    if (project) {
      await this.eventsService.appendEvent(
        projectId,
        {
          type: 'project.transitioned',
          data: {
            projectId,
            action,
            previousStatus: existing.status,
            newStatus: project.status,
          },
          resourceId: projectId,
          resourceRevision: project.revision,
        },
        { userId: requestingUser.id, role: requestingUser.role },
      );

      await this.auditService.log({
        eventType: 'project.transitioned',
        actorId: requestingUser.id,
        projectId,
        resourceType: 'project',
        resourceId: projectId,
        metadata: {
          action,
          previousStatus: existing.status,
          newStatus: project.status,
        },
      });

      return this.toProject(project);
    }

    return (await this.repo.findById(projectId)) ? 'conflict' : null;
  }

  async transitionArchive(
    projectId: string,
    action: 'archive' | 'restore',
    expectedRevision: number,
    requestingUser: { id: string; role: string },
  ): Promise<
    ProjectContract | null | 'conflict' | 'forbidden' | 'invalid_transition'
  > {
    const existing = await this.repo.findById(projectId);
    if (!existing) return null;

    if (requestingUser.role !== 'admin') {
      if (!(await this.repo.isMember(projectId, requestingUser.id))) {
        return null;
      }
      if (existing.ownerId !== requestingUser.id) return 'forbidden';
    }

    if (action === 'archive' && existing.status === 'reviewing') {
      return 'invalid_transition';
    }

    const update =
      action === 'archive'
        ? { status: 'archived' as const, archivedFromStatus: existing.status }
        : {
            status: existing.archivedFromStatus ?? 'draft',
            archivedFromStatus: null,
          };

    const project = await this.repo.update(projectId, update, expectedRevision);

    if (project) {
      // 发布归档/恢复事件
      await this.eventsService.appendEvent(
        projectId,
        {
          type: action === 'archive' ? 'project.archived' : 'project.restored',
          data: {
            projectId,
            action,
            previousStatus: existing.status,
            newStatus: project.status,
          },
          resourceId: projectId,
          resourceRevision: project.revision,
        },
        { userId: requestingUser.id, role: requestingUser.role },
      );

      return this.toProject(project);
    }

    return 'conflict';
  }

  async transitionReview(
    projectId: string,
    action: 'submit_review' | 'approve' | 'request_changes' | 'reopen',
    comment: string | undefined,
    expectedRevision: number,
    requestingUser: { id: string; role: string },
  ): Promise<
    | ProjectContract
    | null
    | 'conflict'
    | 'forbidden'
    | 'invalid_transition'
    | 'precondition_failed'
  > {
    const existing = await this.repo.findById(projectId);
    if (!existing) return null;

    if (action === 'submit_review') {
      if (!['admin', 'designer'].includes(requestingUser.role))
        return 'forbidden';
      if (
        requestingUser.role === 'designer' &&
        !(await this.repo.isMember(projectId, requestingUser.id))
      ) {
        return null;
      }
      if (!existing.selectedVersionId) return 'precondition_failed';
      if (existing.status !== 'designing') return 'invalid_transition';
    } else if (action === 'approve') {
      if (!['admin', 'sales'].includes(requestingUser.role)) return 'forbidden';
      if (
        requestingUser.role === 'sales' &&
        !(await this.repo.isMember(projectId, requestingUser.id))
      ) {
        return null;
      }
      if (existing.status !== 'reviewing') return 'invalid_transition';
    } else if (action === 'request_changes') {
      if (!['admin', 'sales'].includes(requestingUser.role)) return 'forbidden';
      if (
        requestingUser.role === 'sales' &&
        !(await this.repo.isMember(projectId, requestingUser.id))
      ) {
        return null;
      }
      if (existing.status !== 'reviewing') return 'invalid_transition';
    } else {
      if (requestingUser.role !== 'admin') return 'forbidden';
      if (existing.status !== 'approved') return 'invalid_transition';
    }

    let updateData: Partial<
      Omit<NewProject, 'id' | 'createdAt' | 'updatedAt' | 'revision'>
    >;

    if (action === 'submit_review') {
      updateData = { status: 'reviewing', rejectionReason: null };
    } else if (action === 'approve') {
      const approvedAt = new Date();
      updateData = {
        status: 'approved',
        approvedAt,
        approvedSnapshot: {
          selectedVersionId: existing.selectedVersionId,
          approvedBy: requestingUser.id,
          approvedAt: approvedAt.toISOString(),
          comment,
        },
        rejectionReason: null,
      };
    } else if (action === 'request_changes') {
      updateData = {
        status: 'designing',
        rejectionReason: comment ?? null,
      };
    } else {
      updateData = {
        status: 'reviewing',
        approvedAt: null,
      };
    }

    const project = await this.repo.update(
      projectId,
      updateData,
      expectedRevision,
    );

    if (project) {
      await this.eventsService.appendEvent(
        projectId,
        {
          type: 'project.transitioned',
          data: {
            projectId,
            action,
            previousStatus: existing.status,
            newStatus: project.status,
            comment,
          },
          resourceId: projectId,
          resourceRevision: project.revision,
        },
        { userId: requestingUser.id, role: requestingUser.role },
      );

      await this.auditService.log({
        eventType: 'project.transitioned',
        actorId: requestingUser.id,
        projectId,
        resourceType: 'project',
        resourceId: projectId,
        metadata: {
          action,
          previousStatus: existing.status,
          newStatus: project.status,
          comment,
        },
      });

      return this.toProject(project);
    }

    return (await this.repo.findById(projectId)) ? 'conflict' : null;
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
      rejectionReason: project.rejectionReason ?? null,
      approvedAt: project.approvedAt ? project.approvedAt.toISOString() : null,
      approvedSnapshot: project.approvedSnapshot ?? null,
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
