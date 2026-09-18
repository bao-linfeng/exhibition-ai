import type { ImageVersion } from '@exhibition/contracts';
import type { ImageVersion as DbImageVersion } from '@exhibition/db';
import { isProjectLocked } from '../../shared/project-write-guard.js';
import type { ImageVersionRepository } from './image-versions.repository.js';

function toVersionDto(row: DbImageVersion): ImageVersion {
  return {
    id: row.id,
    projectId: row.projectId,
    assetId: row.assetId,
    parentVersionId: row.parentVersionId,
    taskId: row.taskId,
    outputOrdinal: row.outputOrdinal,
    sequence: row.sequence,
    briefRevisionId: row.briefRevisionId,
    width: row.width,
    height: row.height,
    sizeBytes: Number(row.sizeBytes),
    mimeType: row.mimeType,
    createdBy: row.createdBy,
    createdAt: row.createdAt.toISOString(),
  };
}

export class ImageVersionService {
  constructor(private repo: ImageVersionRepository) {}

  async listVersions(
    projectId: string,
    opts: {
      parentVersionId?: string | 'root';
      briefRevisionId?: string;
      includeHidden?: boolean;
      cursor?: string;
      limit?: number;
    },
    isMemberOrAdmin: boolean,
  ): Promise<
    | {
        data: ImageVersion[];
        page: { nextCursor: string | null; hasMore: boolean };
      }
    | 'forbidden'
  > {
    if (!isMemberOrAdmin) return 'forbidden';

    const result = await this.repo.listByProject({ projectId, ...opts });
    return { data: result.data.map(toVersionDto), page: result.page };
  }

  async getVersion(
    id: string,
    isMemberOrAdmin: boolean,
    projectId?: string,
  ): Promise<ImageVersion | 'not_found' | 'forbidden'> {
    const version = await this.repo.findById(id);
    if (!version) return 'not_found';
    if (projectId && version.projectId !== projectId) return 'not_found';
    if (!isMemberOrAdmin) return 'forbidden';
    return toVersionDto(version);
  }

  async hideVersion(
    id: string,
    projectId: string,
    isMemberOrAdmin: boolean,
    projectStatus: string,
  ): Promise<
    'ok' | 'not_found' | 'forbidden' | 'already_hidden' | 'project_locked'
  > {
    const version = await this.repo.findById(id);
    if (!version || version.projectId !== projectId) return 'not_found';
    if (!isMemberOrAdmin) return 'forbidden';
    if (isProjectLocked(projectStatus)) return 'project_locked';
    if (version.hiddenAt) return 'already_hidden';

    const updated = await this.repo.hideVersion(id);
    return updated ? 'ok' : 'not_found';
  }

  async updateSelectedVersion(
    projectId: string,
    versionId: string | null,
    expectedRevision: number,
    isMemberOrAdmin: boolean,
    projectStatus: string,
  ): Promise<
    | { selectedVersionId: string | null; revision: number }
    | 'conflict'
    | 'forbidden'
    | 'version_not_found'
    | 'project_locked'
  > {
    if (!isMemberOrAdmin) return 'forbidden';
    if (isProjectLocked(projectStatus)) return 'project_locked';

    if (versionId) {
      const version = await this.repo.findById(versionId);
      if (!version || version.projectId !== projectId) {
        return 'version_not_found';
      }
    }

    return this.repo.updateSelectedVersion(
      projectId,
      versionId,
      expectedRevision,
    );
  }

  async publishVersions(
    inputs: Parameters<ImageVersionRepository['publishVersions']>[0],
  ): Promise<DbImageVersion[]> {
    return this.repo.publishVersions(inputs);
  }
}
