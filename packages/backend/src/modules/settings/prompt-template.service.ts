import { type Database, promptTemplates, promptVersions } from '@exhibition/db';
import type {
  CreatePromptTemplateRequest,
  CreatePromptVersionRequest,
  UpdatePromptVersionRequest,
} from '@exhibition/contracts';
import type { AuditService } from '../audit/index.js';
import type { PromptTemplateRepository } from './prompt-template.repository.js';

export class PromptTemplateService {
  constructor(
    private readonly db: Database,
    private readonly promptRepo: PromptTemplateRepository,
    private readonly auditService: AuditService,
  ) {}

  async listTemplates() {
    return this.promptRepo.findAllWithCurrentVersion();
  }

  async getTemplate(id: string) {
    return this.promptRepo.findWithVersions(id);
  }

  async createTemplate(
    input: CreatePromptTemplateRequest,
    actor: { id: string; email: string },
  ) {
    const existing = await this.promptRepo.findByKey(input.templateKey);
    if (existing) {
      throw Object.assign(new Error('Template key already exists'), {
        code: 'CONFLICT',
      });
    }

    return this.db.transaction(async (tx) => {
      const templateRows = await tx
        .insert(promptTemplates)
        .values({
          name: input.name,
          description: input.description ?? null,
          templateKey: input.templateKey,
        })
        .returning();
      const template = templateRows[0]!;

      const versionRows = await tx
        .insert(promptVersions)
        .values({
          templateId: template.id,
          version: 1,
          status: 'draft',
          content: input.initialContent,
          variables: input.variables ?? [],
          changeNote: input.changeNote ?? null,
        })
        .returning();
      const version = versionRows[0]!;

      await this.auditService.log({
        eventType: 'prompt_template.create',
        actorId: actor.id,
        actorEmail: actor.email,
        resourceType: 'prompt_template',
        resourceId: template.id,
        metadata: { templateKey: template.templateKey },
      });

      return { template, version };
    });
  }

  async createVersion(
    templateId: string,
    input: CreatePromptVersionRequest,
    actor: { id: string; email: string },
  ) {
    const template = await this.promptRepo.findById(templateId);
    if (!template) {
      throw Object.assign(new Error('Template not found'), {
        code: 'NOT_FOUND',
      });
    }

    const nextVersion = await this.promptRepo.nextVersionNumber(templateId);
    const version = await this.promptRepo.createVersion({
      templateId,
      version: nextVersion,
      status: 'draft',
      content: input.content,
      variables: input.variables ?? [],
      changeNote: input.changeNote ?? null,
    });

    await this.auditService.log({
      eventType: 'prompt_version.create_draft',
      actorId: actor.id,
      actorEmail: actor.email,
      resourceType: 'prompt_version',
      resourceId: version.id,
      metadata: { templateId, version: nextVersion },
    });

    return version;
  }

  async updateVersion(
    templateId: string,
    versionId: string,
    input: UpdatePromptVersionRequest,
    actor: { id: string; email: string },
  ) {
    const version = await this.promptRepo.findVersionById(versionId);
    if (!version || version.templateId !== templateId) {
      throw Object.assign(new Error('Version not found'), {
        code: 'NOT_FOUND',
      });
    }
    if (version.status !== 'draft') {
      throw Object.assign(new Error('Only draft versions can be edited'), {
        code: 'UNPROCESSABLE',
      });
    }

    const updated = await this.promptRepo.updateVersion(versionId, {
      ...(input.content !== undefined && { content: input.content }),
      ...(input.variables !== undefined && { variables: input.variables }),
      ...(input.changeNote !== undefined && { changeNote: input.changeNote }),
    });

    await this.auditService.log({
      eventType: 'prompt_version.update_draft',
      actorId: actor.id,
      actorEmail: actor.email,
      resourceType: 'prompt_version',
      resourceId: versionId,
      metadata: { templateId },
    });

    return updated;
  }

  async publishVersion(
    templateId: string,
    versionId: string,
    input: { changeNote?: string },
    actor: { id: string; email: string },
  ) {
    const version = await this.promptRepo.findVersionById(versionId);
    if (!version || version.templateId !== templateId) {
      throw Object.assign(new Error('Version not found'), {
        code: 'NOT_FOUND',
      });
    }
    if (version.status !== 'draft') {
      throw Object.assign(new Error('Only draft versions can be published'), {
        code: 'UNPROCESSABLE',
      });
    }

    const now = new Date();
    await this.promptRepo.updateVersion(versionId, {
      status: 'published',
      publishedAt: now,
      publishedBy: actor.id,
      ...(input.changeNote !== undefined && { changeNote: input.changeNote }),
    });
    await this.promptRepo.setCurrentVersion(templateId, versionId);

    await this.auditService.log({
      eventType: 'prompt_version.publish',
      actorId: actor.id,
      actorEmail: actor.email,
      resourceType: 'prompt_version',
      resourceId: versionId,
      metadata: { templateId, publishedAt: now.toISOString() },
    });

    return this.promptRepo.findWithVersions(templateId);
  }

  async rollbackToVersion(
    templateId: string,
    versionId: string,
    actor: { id: string; email: string },
  ) {
    const version = await this.promptRepo.findVersionById(versionId);
    if (!version || version.templateId !== templateId) {
      throw Object.assign(new Error('Version not found'), {
        code: 'NOT_FOUND',
      });
    }
    if (version.status !== 'published') {
      throw Object.assign(
        new Error('Can only rollback to a published version'),
        { code: 'UNPROCESSABLE' },
      );
    }

    await this.promptRepo.setCurrentVersion(templateId, versionId);

    await this.auditService.log({
      eventType: 'prompt_version.rollback',
      actorId: actor.id,
      actorEmail: actor.email,
      resourceType: 'prompt_version',
      resourceId: versionId,
      metadata: { templateId },
    });

    return this.promptRepo.findWithVersions(templateId);
  }

  async getCurrentPublishedContent(
    templateKey: string,
  ): Promise<string | null> {
    const template = await this.promptRepo.findByKey(templateKey);
    if (!template?.currentVersionId) return null;
    const version = await this.promptRepo.findVersionById(
      template.currentVersionId,
    );
    return version?.content ?? null;
  }
}
