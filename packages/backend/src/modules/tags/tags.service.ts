import type { ProjectTag } from '@exhibition/contracts';
import type { ProjectTag as DbProjectTag } from '@exhibition/db';
import type { AuditService } from '../audit/audit.service.js';
import type { TagRepository } from './tags.repository.js';

export function normalizeTagName(name: string): string {
  return name.normalize('NFKC').trim().toLowerCase();
}

function toTagDto(row: DbProjectTag): ProjectTag {
  return {
    id: row.id,
    projectId: row.projectId,
    name: row.name,
    color: row.color ?? null,
    createdBy: row.createdBy,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export class TagService {
  constructor(
    private repo: TagRepository,
    private auditService: AuditService,
  ) {}

  async listTags(
    projectId: string,
    isMember: boolean,
  ): Promise<ProjectTag[] | 'forbidden'> {
    if (!isMember) return 'forbidden';
    const tags = await this.repo.listByProject(projectId);
    return tags.map(toTagDto);
  }

  async createTag(
    projectId: string,
    input: { name: string; color?: string },
    requestedBy: string,
    requestingUser: { id: string; role: string },
    isMember: boolean,
  ): Promise<
    | ProjectTag
    | 'forbidden'
    | 'project_not_found'
    | 'project_archived'
    | 'project_tag_limit_reached'
    | 'name_conflict'
  > {
    if (!isMember || !['admin', 'designer'].includes(requestingUser.role)) {
      return 'forbidden';
    }

    const nameKey = normalizeTagName(input.name);
    if (!nameKey) return 'name_conflict';

    const result = await this.repo.createTag({
      projectId,
      name: input.name.trim(),
      nameKey,
      color: input.color ?? null,
      createdBy: requestedBy,
    });
    if (typeof result === 'string') return result;

    void this.auditService
      .log({
        eventType: 'tag.create',
        actorId: requestedBy,
        actorEmail: requestingUser.id,
        projectId,
        resourceType: 'tag',
        resourceId: result.id,
        metadata: { name: result.name },
      })
      .catch(() => undefined);

    return toTagDto(result);
  }

  async updateTag(
    projectId: string,
    tagId: string,
    input: { name?: string; color?: string | null },
    requestedBy: string,
    requestingUser: { id: string; role: string },
    isMember: boolean,
  ): Promise<
    | ProjectTag
    | 'forbidden'
    | 'not_found'
    | 'project_archived'
    | 'name_conflict'
  > {
    if (!isMember || !['admin', 'designer'].includes(requestingUser.role)) {
      return 'forbidden';
    }

    const tag = await this.repo.findById(tagId);
    if (!tag || tag.projectId !== projectId) return 'not_found';

    const updatePayload: {
      name?: string;
      nameKey?: string;
      color?: string | null;
    } = {};
    if (input.name !== undefined) {
      const nameKey = normalizeTagName(input.name);
      if (!nameKey) return 'name_conflict';
      updatePayload.name = input.name.trim();
      updatePayload.nameKey = nameKey;
    }
    if (input.color !== undefined) updatePayload.color = input.color;

    const result = await this.repo.updateTag(tagId, updatePayload);
    if (typeof result === 'string') return result;

    void this.auditService
      .log({
        eventType: 'tag.update',
        actorId: requestedBy,
        actorEmail: requestingUser.id,
        projectId,
        resourceType: 'tag',
        resourceId: tagId,
        metadata: input,
      })
      .catch(() => undefined);

    return toTagDto(result);
  }

  async deleteTag(
    projectId: string,
    tagId: string,
    requestedBy: string,
    requestingUser: { id: string; role: string },
    isMember: boolean,
  ): Promise<'ok' | 'forbidden' | 'not_found' | 'project_archived'> {
    if (!isMember || !['admin', 'designer'].includes(requestingUser.role)) {
      return 'forbidden';
    }

    const tag = await this.repo.findById(tagId);
    if (!tag || tag.projectId !== projectId) return 'not_found';

    const result = await this.repo.deleteTag(tagId);
    if (result !== 'ok') return result;

    void this.auditService
      .log({
        eventType: 'tag.delete',
        actorId: requestedBy,
        actorEmail: requestingUser.id,
        projectId,
        resourceType: 'tag',
        resourceId: tagId,
        metadata: { name: tag.name },
      })
      .catch(() => undefined);

    return 'ok';
  }

  async assignTagToAsset(
    projectId: string,
    tagId: string,
    assetId: string,
    requestedBy: string,
    requestingUser: { id: string; role: string },
    isMember: boolean,
  ): Promise<
    | 'ok'
    | 'forbidden'
    | 'tag_not_found'
    | 'resource_not_found'
    | 'project_archived'
    | 'project_mismatch'
    | 'resource_tag_limit_reached'
  > {
    if (!isMember || requestingUser.role === 'viewer') return 'forbidden';
    const tag = await this.repo.findById(tagId);
    if (!tag || tag.projectId !== projectId) return 'tag_not_found';

    const result = await this.repo.assignTagToAsset({
      tagId,
      assetId,
      assignedBy: requestedBy,
    });
    if (result !== 'ok') return result;

    void this.auditService
      .log({
        eventType: 'tag.assign',
        actorId: requestedBy,
        actorEmail: requestingUser.id,
        projectId,
        resourceType: 'asset',
        resourceId: assetId,
        metadata: { tagId },
      })
      .catch(() => undefined);
    return 'ok';
  }

  async unassignTagFromAsset(
    projectId: string,
    tagId: string,
    assetId: string,
    requestedBy: string,
    requestingUser: { id: string; role: string },
    isMember: boolean,
  ): Promise<'ok' | 'forbidden' | 'tag_not_found' | 'project_archived'> {
    if (!isMember || requestingUser.role === 'viewer') return 'forbidden';
    const tag = await this.repo.findById(tagId);
    if (!tag || tag.projectId !== projectId) return 'tag_not_found';

    const result = await this.repo.unassignTagFromAsset(tagId, assetId);
    if (result !== 'ok') return result;

    void this.auditService
      .log({
        eventType: 'tag.unassign',
        actorId: requestedBy,
        actorEmail: requestingUser.id,
        projectId,
        resourceType: 'asset',
        resourceId: assetId,
        metadata: { tagId },
      })
      .catch(() => undefined);
    return 'ok';
  }

  async assignTagToVersion(
    projectId: string,
    tagId: string,
    versionId: string,
    requestedBy: string,
    requestingUser: { id: string; role: string },
    isMember: boolean,
  ): Promise<
    | 'ok'
    | 'forbidden'
    | 'tag_not_found'
    | 'resource_not_found'
    | 'project_archived'
    | 'project_mismatch'
    | 'resource_tag_limit_reached'
  > {
    if (!isMember || requestingUser.role === 'viewer') return 'forbidden';
    const tag = await this.repo.findById(tagId);
    if (!tag || tag.projectId !== projectId) return 'tag_not_found';

    const result = await this.repo.assignTagToVersion({
      tagId,
      versionId,
      assignedBy: requestedBy,
    });
    if (result !== 'ok') return result;

    void this.auditService
      .log({
        eventType: 'tag.assign',
        actorId: requestedBy,
        actorEmail: requestingUser.id,
        projectId,
        resourceType: 'image_version',
        resourceId: versionId,
        metadata: { tagId },
      })
      .catch(() => undefined);
    return 'ok';
  }

  async unassignTagFromVersion(
    projectId: string,
    tagId: string,
    versionId: string,
    requestedBy: string,
    requestingUser: { id: string; role: string },
    isMember: boolean,
  ): Promise<'ok' | 'forbidden' | 'tag_not_found' | 'project_archived'> {
    if (!isMember || requestingUser.role === 'viewer') return 'forbidden';
    const tag = await this.repo.findById(tagId);
    if (!tag || tag.projectId !== projectId) return 'tag_not_found';

    const result = await this.repo.unassignTagFromVersion(tagId, versionId);
    if (result !== 'ok') return result;

    void this.auditService
      .log({
        eventType: 'tag.unassign',
        actorId: requestedBy,
        actorEmail: requestingUser.id,
        projectId,
        resourceType: 'image_version',
        resourceId: versionId,
        metadata: { tagId },
      })
      .catch(() => undefined);
    return 'ok';
  }
}
