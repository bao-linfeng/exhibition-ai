import { and, desc, eq, isNull, lt, ne, sum } from 'drizzle-orm';
import { assets, uploadSessions, type Database } from '@exhibition/db';
import type { AssetKind, AssetStatus } from '@exhibition/contracts';

export class AssetRepository {
  constructor(private db: Database) {}

  async createUploadSession(input: {
    projectId: string;
    bucket: string;
    objectKey: string;
    kind: AssetKind;
    originalFilename: string;
    mimeType: string;
    sizeBytes: number;
    createdBy: string;
    expiresAt: Date;
  }) {
    const [row] = await this.db
      .insert(uploadSessions)
      .values(input)
      .returning();
    if (!row) throw new Error('Failed to create upload session');
    return row;
  }

  async findUploadSession(id: string) {
    const [row] = await this.db
      .select()
      .from(uploadSessions)
      .where(eq(uploadSessions.id, id));
    return row ?? null;
  }

  async completeUploadSession(sessionId: string, assetId: string) {
    await this.db
      .update(uploadSessions)
      .set({ status: 'completed', assetId, completedAt: new Date() })
      .where(eq(uploadSessions.id, sessionId));
  }

  async failUploadSession(sessionId: string) {
    await this.db
      .update(uploadSessions)
      .set({ status: 'failed' })
      .where(eq(uploadSessions.id, sessionId));
  }

  async createAsset(input: {
    projectId: string;
    kind: AssetKind;
    bucket: string;
    objectKey: string;
    originalFilename: string;
    mimeType: string;
    sizeBytes: number;
    createdBy: string;
    sourceAssetId?: string;
  }) {
    const [row] = await this.db.insert(assets).values(input).returning();
    if (!row) throw new Error('Failed to create asset');
    return row;
  }

  async findById(id: string) {
    const [row] = await this.db.select().from(assets).where(eq(assets.id, id));
    return row ?? null;
  }

  async findBySessionId(sessionId: string) {
    const [session] = await this.db
      .select()
      .from(uploadSessions)
      .where(eq(uploadSessions.id, sessionId));
    if (!session?.assetId) return null;
    return this.findById(session.assetId);
  }

  async list(opts: {
    projectId: string;
    kind?: AssetKind;
    status?: AssetStatus;
    includeHidden?: boolean;
    cursor?: string;
    limit?: number;
  }) {
    const limit = Math.min(opts.limit ?? 20, 100);
    const conditions = [eq(assets.projectId, opts.projectId)];

    if (!opts.includeHidden) conditions.push(isNull(assets.hiddenAt));
    if (opts.kind) conditions.push(eq(assets.kind, opts.kind));
    if (opts.status) conditions.push(eq(assets.status, opts.status));
    if (opts.cursor) {
      conditions.push(
        lt(
          assets.createdAt,
          new Date(Buffer.from(opts.cursor, 'base64url').toString()),
        ),
      );
    }

    const rows = await this.db
      .select()
      .from(assets)
      .where(and(...conditions))
      .orderBy(desc(assets.createdAt))
      .limit(limit + 1);

    const hasMore = rows.length > limit;
    const data = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor =
      hasMore && data.length > 0
        ? Buffer.from(data[data.length - 1]!.createdAt.toISOString()).toString(
            'base64url',
          )
        : null;

    return { data, page: { nextCursor, hasMore } };
  }

  async hideAsset(id: string) {
    const [row] = await this.db
      .update(assets)
      .set({ hiddenAt: new Date(), updatedAt: new Date() })
      .where(and(eq(assets.id, id), isNull(assets.hiddenAt)))
      .returning();
    return row ?? null;
  }

  async updateStatus(
    id: string,
    status: AssetStatus,
    extra?: { sha256?: string; width?: number; height?: number },
  ) {
    const [row] = await this.db
      .update(assets)
      .set({ status, updatedAt: new Date(), ...extra })
      .where(eq(assets.id, id))
      .returning();
    return row ?? null;
  }

  async getProjectUsageBytes(
    projectId: string,
    excludeAssetId: string,
  ): Promise<number> {
    const result = await this.db
      .select({ total: sum(assets.sizeBytes) })
      .from(assets)
      .where(
        and(
          eq(assets.projectId, projectId),
          eq(assets.status, 'ready'),
          ne(assets.id, excludeAssetId),
        ),
      );
    return Number(result[0]?.total ?? 0);
  }

  async updateStatusAndKey(
    id: string,
    status: AssetStatus,
    extra: { sha256: string; width: number; height: number; objectKey: string },
  ) {
    const [row] = await this.db
      .update(assets)
      .set({ status, updatedAt: new Date(), ...extra })
      .where(eq(assets.id, id))
      .returning();
    return row ?? null;
  }

  async findThumbnailBySourceId(sourceAssetId: string) {
    const [row] = await this.db
      .select()
      .from(assets)
      .where(
        and(
          eq(assets.sourceAssetId, sourceAssetId),
          eq(assets.kind, 'thumbnail'),
        ),
      )
      .limit(1);
    return row ?? null;
  }
}
