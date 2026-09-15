import { and, eq } from 'drizzle-orm';
import {
  type Database,
  modelConfigs,
  type ModelConfig,
  type NewModelConfig,
} from '@exhibition/db';

export class ModelConfigRepository {
  constructor(private readonly db: Database) {}

  async findAll(activeOnly = false): Promise<ModelConfig[]> {
    if (activeOnly) {
      return this.db
        .select()
        .from(modelConfigs)
        .where(eq(modelConfigs.isActive, true));
    }
    return this.db.select().from(modelConfigs);
  }

  async findById(id: string): Promise<ModelConfig | undefined> {
    const rows = await this.db
      .select()
      .from(modelConfigs)
      .where(eq(modelConfigs.id, id))
      .limit(1);
    return rows[0];
  }

  async findByProviderAndModel(
    providerId: string,
    modelId: string,
  ): Promise<ModelConfig | undefined> {
    const rows = await this.db
      .select()
      .from(modelConfigs)
      .where(
        and(
          eq(modelConfigs.providerId, providerId),
          eq(modelConfigs.modelId, modelId),
        ),
      )
      .limit(1);
    return rows[0];
  }

  async upsert(
    input: Omit<NewModelConfig, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<ModelConfig> {
    const rows = await this.db
      .insert(modelConfigs)
      .values({ ...input })
      .onConflictDoUpdate({
        target: [modelConfigs.providerId, modelConfigs.modelId],
        set: {
          displayName: input.displayName,
          description: input.description,
          capabilities: input.capabilities,
          costPerImageMinor: input.costPerImageMinor,
          currency: input.currency,
          isActive: input.isActive,
          maxConcurrent: input.maxConcurrent,
          parametersSchema: input.parametersSchema,
          updatedAt: new Date(),
        },
      })
      .returning();
    return rows[0]!;
  }

  async update(
    id: string,
    patch: Partial<
      Pick<
        ModelConfig,
        | 'isActive'
        | 'maxConcurrent'
        | 'costPerImageMinor'
        | 'displayName'
        | 'description'
      >
    >,
  ): Promise<ModelConfig | undefined> {
    const rows = await this.db
      .update(modelConfigs)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(modelConfigs.id, id))
      .returning();
    return rows[0];
  }
}
