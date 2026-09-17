import type {
  AssetFavorite,
  ImageVersionFavorite,
} from '@exhibition/contracts';
import type { AuditService } from '../audit/audit.service.js';
import type { FavoriteRepository } from './favorites.repository.js';

export class FavoriteService {
  constructor(
    private repo: FavoriteRepository,
    private auditService: AuditService,
  ) {}

  async setAssetFavorite(
    projectId: string,
    assetId: string,
    userId: string,
    isMember: boolean,
  ): Promise<'ok' | 'forbidden'> {
    if (!isMember) return 'forbidden';
    await this.repo.setAssetFavorite(userId, assetId, projectId);
    void this.auditService
      .log({
        eventType: 'favorite.set',
        actorId: userId,
        projectId,
        resourceType: 'asset',
        resourceId: assetId,
        metadata: {},
      })
      .catch(() => undefined);
    return 'ok';
  }

  async unsetAssetFavorite(
    projectId: string,
    assetId: string,
    userId: string,
    isMember: boolean,
  ): Promise<'ok' | 'forbidden'> {
    if (!isMember) return 'forbidden';
    await this.repo.unsetAssetFavorite(userId, assetId);
    void this.auditService
      .log({
        eventType: 'favorite.unset',
        actorId: userId,
        projectId,
        resourceType: 'asset',
        resourceId: assetId,
        metadata: {},
      })
      .catch(() => undefined);
    return 'ok';
  }

  async listAssetFavorites(
    projectId: string,
    userId: string,
    opts: { cursor?: string; limit?: number },
    isMember: boolean,
  ): Promise<
    | {
        data: AssetFavorite[];
        page: { nextCursor: string | null; hasMore: boolean };
      }
    | 'forbidden'
  > {
    if (!isMember) return 'forbidden';
    const result = await this.repo.listAssetFavorites(userId, projectId, opts);
    return {
      data: result.data.map((row) => ({
        assetId: row.assetId,
        projectId: row.projectId,
        createdAt: row.createdAt.toISOString(),
      })),
      page: result.page,
    };
  }

  async setVersionFavorite(
    projectId: string,
    versionId: string,
    userId: string,
    isMember: boolean,
  ): Promise<'ok' | 'forbidden'> {
    if (!isMember) return 'forbidden';
    await this.repo.setVersionFavorite(userId, versionId, projectId);
    void this.auditService
      .log({
        eventType: 'favorite.set',
        actorId: userId,
        projectId,
        resourceType: 'image_version',
        resourceId: versionId,
        metadata: {},
      })
      .catch(() => undefined);
    return 'ok';
  }

  async unsetVersionFavorite(
    projectId: string,
    versionId: string,
    userId: string,
    isMember: boolean,
  ): Promise<'ok' | 'forbidden'> {
    if (!isMember) return 'forbidden';
    await this.repo.unsetVersionFavorite(userId, versionId);
    void this.auditService
      .log({
        eventType: 'favorite.unset',
        actorId: userId,
        projectId,
        resourceType: 'image_version',
        resourceId: versionId,
        metadata: {},
      })
      .catch(() => undefined);
    return 'ok';
  }

  async listVersionFavorites(
    projectId: string,
    userId: string,
    opts: { cursor?: string; limit?: number },
    isMember: boolean,
  ): Promise<
    | {
        data: ImageVersionFavorite[];
        page: { nextCursor: string | null; hasMore: boolean };
      }
    | 'forbidden'
  > {
    if (!isMember) return 'forbidden';
    const result = await this.repo.listVersionFavorites(
      userId,
      projectId,
      opts,
    );
    return {
      data: result.data.map((row) => ({
        versionId: row.versionId,
        projectId: row.projectId,
        createdAt: row.createdAt.toISOString(),
      })),
      page: result.page,
    };
  }
}
