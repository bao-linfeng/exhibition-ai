import { desc, eq, max } from 'drizzle-orm';
import {
  type Database,
  promptTemplates,
  promptVersions,
  type NewPromptTemplate,
  type NewPromptVersion,
  type PromptTemplate,
  type PromptVersion,
} from '@exhibition/db';

export class PromptTemplateRepository {
  constructor(private readonly db: Database) {}

  async findAllWithCurrentVersion(): Promise<
    Array<PromptTemplate & { currentVersion: PromptVersion | null }>
  > {
    const rows = await this.db
      .select()
      .from(promptTemplates)
      .leftJoin(
        promptVersions,
        eq(promptTemplates.currentVersionId, promptVersions.id),
      )
      .orderBy(promptTemplates.createdAt);

    return rows.map(({ prompt_templates, prompt_versions }) => ({
      ...prompt_templates,
      currentVersion: prompt_versions ?? null,
    }));
  }

  async findById(id: string): Promise<PromptTemplate | undefined> {
    const rows = await this.db
      .select()
      .from(promptTemplates)
      .where(eq(promptTemplates.id, id))
      .limit(1);
    return rows[0];
  }

  async findByKey(templateKey: string): Promise<PromptTemplate | undefined> {
    const rows = await this.db
      .select()
      .from(promptTemplates)
      .where(eq(promptTemplates.templateKey, templateKey))
      .limit(1);
    return rows[0];
  }

  async findWithVersions(
    id: string,
  ): Promise<
    { template: PromptTemplate; versions: PromptVersion[] } | undefined
  > {
    const templates = await this.db
      .select()
      .from(promptTemplates)
      .where(eq(promptTemplates.id, id))
      .limit(1);
    if (!templates[0]) return undefined;

    const versions = await this.db
      .select()
      .from(promptVersions)
      .where(eq(promptVersions.templateId, id))
      .orderBy(desc(promptVersions.version));

    return { template: templates[0], versions };
  }

  async create(
    input: Pick<NewPromptTemplate, 'name' | 'description' | 'templateKey'>,
  ): Promise<PromptTemplate> {
    const rows = await this.db
      .insert(promptTemplates)
      .values(input)
      .returning();
    return rows[0]!;
  }

  async setCurrentVersion(
    templateId: string,
    versionId: string | null,
  ): Promise<void> {
    await this.db
      .update(promptTemplates)
      .set({ currentVersionId: versionId, updatedAt: new Date() })
      .where(eq(promptTemplates.id, templateId));
  }

  async nextVersionNumber(templateId: string): Promise<number> {
    const result = await this.db
      .select({ maxVersion: max(promptVersions.version) })
      .from(promptVersions)
      .where(eq(promptVersions.templateId, templateId));
    return (result[0]?.maxVersion ?? 0) + 1;
  }

  async createVersion(
    input: Omit<NewPromptVersion, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<PromptVersion> {
    const rows = await this.db.insert(promptVersions).values(input).returning();
    return rows[0]!;
  }

  async findVersionById(id: string): Promise<PromptVersion | undefined> {
    const rows = await this.db
      .select()
      .from(promptVersions)
      .where(eq(promptVersions.id, id))
      .limit(1);
    return rows[0];
  }

  async updateVersion(
    id: string,
    patch: Partial<
      Pick<
        PromptVersion,
        | 'content'
        | 'variables'
        | 'changeNote'
        | 'status'
        | 'publishedAt'
        | 'publishedBy'
      >
    >,
  ): Promise<PromptVersion | undefined> {
    const rows = await this.db
      .update(promptVersions)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(promptVersions.id, id))
      .returning();
    return rows[0];
  }
}
