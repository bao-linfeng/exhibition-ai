import { and, count, eq, sql } from 'drizzle-orm';
import type { Database } from '@exhibition/db';
import {
  projectTags,
  assetTagAssignments,
  imageVersionTagAssignments,
  assets,
  imageVersions,
  projects,
} from '@exhibition/db';

export class TagRepository {
  constructor(private db: Database) {}

  async findById(id: string) {
    const [row] = await this.db
      .select()
      .from(projectTags)
      .where(eq(projectTags.id, id));
    return row ?? null;
  }

  async listByProject(projectId: string) {
    return this.db
      .select()
      .from(projectTags)
      .where(eq(projectTags.projectId, projectId))
      .orderBy(projectTags.name);
  }

  async createTag(input: {
    projectId: string;
    name: string;
    nameKey: string;
    color: string | null;
    createdBy: string;
  }) {
    return this.db.transaction(async (tx) => {
      const projectRows = await tx.execute(
        sql<{ id: string; status: string }>`
          SELECT id, status FROM projects WHERE id = ${input.projectId} FOR UPDATE
        `,
      );
      const project = projectRows.rows[0] as
        { id: string; status: string } | undefined;
      if (!project) return 'project_not_found' as const;
      if (project.status === 'archived') return 'project_archived' as const;

      const [countResult] = await tx
        .select({ total: count() })
        .from(projectTags)
        .where(eq(projectTags.projectId, input.projectId));
      if ((countResult?.total ?? 0) >= 50) {
        return 'project_tag_limit_reached' as const;
      }

      const [existing] = await tx
        .select()
        .from(projectTags)
        .where(
          and(
            eq(projectTags.projectId, input.projectId),
            eq(projectTags.nameKey, input.nameKey),
          ),
        );
      if (existing) return 'name_conflict' as const;

      const [tag] = await tx.insert(projectTags).values(input).returning();
      if (!tag) throw new Error('Failed to create tag');
      return tag;
    });
  }

  async updateTag(
    id: string,
    input: { name?: string; nameKey?: string; color?: string | null },
  ) {
    return this.db.transaction(async (tx) => {
      const [current] = await tx
        .select()
        .from(projectTags)
        .where(eq(projectTags.id, id))
        .limit(1);
      if (!current) return 'not_found' as const;

      const [proj] = await tx
        .select({ status: projects.status })
        .from(projects)
        .where(eq(projects.id, current.projectId));
      if (proj?.status === 'archived') return 'project_archived' as const;

      if (input.nameKey) {
        const [conflict] = await tx
          .select()
          .from(projectTags)
          .where(
            and(
              eq(projectTags.projectId, current.projectId),
              eq(projectTags.nameKey, input.nameKey),
            ),
          );
        if (conflict && conflict.id !== id) return 'name_conflict' as const;
      }

      const [updated] = await tx
        .update(projectTags)
        .set({ ...input, updatedAt: new Date() })
        .where(eq(projectTags.id, id))
        .returning();
      return updated ?? ('not_found' as const);
    });
  }

  async deleteTag(id: string) {
    return this.db.transaction(async (tx) => {
      const [current] = await tx
        .select()
        .from(projectTags)
        .where(eq(projectTags.id, id))
        .limit(1);
      if (!current) return 'not_found' as const;

      const [proj] = await tx
        .select({ status: projects.status })
        .from(projects)
        .where(eq(projects.id, current.projectId));
      if (proj?.status === 'archived') return 'project_archived' as const;

      await tx.delete(projectTags).where(eq(projectTags.id, id));
      return 'ok' as const;
    });
  }

  async assignTagToAsset(input: {
    tagId: string;
    assetId: string;
    assignedBy: string;
  }) {
    return this.db.transaction(async (tx) => {
      const [asset] = await tx
        .select({ projectId: assets.projectId })
        .from(assets)
        .where(eq(assets.id, input.assetId))
        .for('update');
      if (!asset) return 'resource_not_found' as const;

      const [tag] = await tx
        .select()
        .from(projectTags)
        .where(eq(projectTags.id, input.tagId));
      if (!tag) return 'tag_not_found' as const;
      if (tag.projectId !== asset.projectId) return 'project_mismatch' as const;

      const [proj] = await tx
        .select({ status: projects.status })
        .from(projects)
        .where(eq(projects.id, asset.projectId));
      if (proj?.status === 'archived') return 'project_archived' as const;

      const [existing] = await tx
        .select()
        .from(assetTagAssignments)
        .where(
          and(
            eq(assetTagAssignments.tagId, input.tagId),
            eq(assetTagAssignments.assetId, input.assetId),
          ),
        );
      if (existing) return 'ok' as const;

      const [countResult] = await tx
        .select({ total: count() })
        .from(assetTagAssignments)
        .where(eq(assetTagAssignments.assetId, input.assetId));
      if ((countResult?.total ?? 0) >= 10) {
        return 'resource_tag_limit_reached' as const;
      }

      await tx.insert(assetTagAssignments).values(input).onConflictDoNothing();
      return 'ok' as const;
    });
  }

  async unassignTagFromAsset(tagId: string, assetId: string) {
    return this.db.transaction(async (tx) => {
      const [tag] = await tx
        .select()
        .from(projectTags)
        .where(eq(projectTags.id, tagId));
      if (!tag) return 'tag_not_found' as const;

      const [proj] = await tx
        .select({ status: projects.status })
        .from(projects)
        .where(eq(projects.id, tag.projectId));
      if (proj?.status === 'archived') return 'project_archived' as const;

      await tx
        .delete(assetTagAssignments)
        .where(
          and(
            eq(assetTagAssignments.tagId, tagId),
            eq(assetTagAssignments.assetId, assetId),
          ),
        );
      return 'ok' as const;
    });
  }

  async assignTagToVersion(input: {
    tagId: string;
    versionId: string;
    assignedBy: string;
  }) {
    return this.db.transaction(async (tx) => {
      const [version] = await tx
        .select({ projectId: imageVersions.projectId })
        .from(imageVersions)
        .where(eq(imageVersions.id, input.versionId))
        .for('update');
      if (!version) return 'resource_not_found' as const;

      const [tag] = await tx
        .select()
        .from(projectTags)
        .where(eq(projectTags.id, input.tagId));
      if (!tag) return 'tag_not_found' as const;
      if (tag.projectId !== version.projectId)
        return 'project_mismatch' as const;

      const [proj] = await tx
        .select({ status: projects.status })
        .from(projects)
        .where(eq(projects.id, version.projectId));
      if (proj?.status === 'archived') return 'project_archived' as const;

      const [existing] = await tx
        .select()
        .from(imageVersionTagAssignments)
        .where(
          and(
            eq(imageVersionTagAssignments.tagId, input.tagId),
            eq(imageVersionTagAssignments.versionId, input.versionId),
          ),
        );
      if (existing) return 'ok' as const;

      const [countResult] = await tx
        .select({ total: count() })
        .from(imageVersionTagAssignments)
        .where(eq(imageVersionTagAssignments.versionId, input.versionId));
      if ((countResult?.total ?? 0) >= 10) {
        return 'resource_tag_limit_reached' as const;
      }

      await tx
        .insert(imageVersionTagAssignments)
        .values(input)
        .onConflictDoNothing();
      return 'ok' as const;
    });
  }

  async unassignTagFromVersion(tagId: string, versionId: string) {
    return this.db.transaction(async (tx) => {
      const [tag] = await tx
        .select()
        .from(projectTags)
        .where(eq(projectTags.id, tagId));
      if (!tag) return 'tag_not_found' as const;

      const [proj] = await tx
        .select({ status: projects.status })
        .from(projects)
        .where(eq(projects.id, tag.projectId));
      if (proj?.status === 'archived') return 'project_archived' as const;

      await tx
        .delete(imageVersionTagAssignments)
        .where(
          and(
            eq(imageVersionTagAssignments.tagId, tagId),
            eq(imageVersionTagAssignments.versionId, versionId),
          ),
        );
      return 'ok' as const;
    });
  }

  async listTagsForAsset(assetId: string) {
    return this.db
      .select({
        id: projectTags.id,
        name: projectTags.name,
        color: projectTags.color,
        projectId: projectTags.projectId,
      })
      .from(assetTagAssignments)
      .innerJoin(projectTags, eq(assetTagAssignments.tagId, projectTags.id))
      .where(eq(assetTagAssignments.assetId, assetId));
  }

  async listTagsForVersion(versionId: string) {
    return this.db
      .select({
        id: projectTags.id,
        name: projectTags.name,
        color: projectTags.color,
        projectId: projectTags.projectId,
      })
      .from(imageVersionTagAssignments)
      .innerJoin(
        projectTags,
        eq(imageVersionTagAssignments.tagId, projectTags.id),
      )
      .where(eq(imageVersionTagAssignments.versionId, versionId));
  }
}
