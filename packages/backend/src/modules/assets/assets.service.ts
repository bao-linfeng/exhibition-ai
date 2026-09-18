import type { Asset, AssetKind, AssetStatus } from '@exhibition/contracts';
import type { StorageProvider } from '../../infrastructure/storage.js';
import { isProjectLocked } from '../../shared/project-write-guard.js';
import type { TaskService } from '../tasks/tasks.service.js';
import type { AssetRepository } from './assets.repository.js';

const UPLOAD_URL_TTL_SECONDS = 3600;
const DOWNLOAD_URL_TTL_SECONDS = 900;

function toAssetDto(row: {
  id: string;
  projectId: string;
  kind: string;
  status: string;
  bucket: string;
  objectKey: string;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number | bigint;
  width: number | null;
  height: number | null;
  sha256: string | null;
  sourceAssetId: string | null;
  hiddenAt: Date | null;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}): Asset {
  return {
    id: row.id,
    projectId: row.projectId,
    kind: row.kind as AssetKind,
    status: row.status as AssetStatus,
    bucket: row.bucket,
    objectKey: row.objectKey,
    originalFilename: row.originalFilename,
    mimeType: row.mimeType,
    sizeBytes: Number(row.sizeBytes),
    width: row.width,
    height: row.height,
    sha256: row.sha256,
    sourceAssetId: row.sourceAssetId,
    hiddenAt: row.hiddenAt?.toISOString() ?? null,
    createdBy: row.createdBy,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export class AssetService {
  constructor(
    private repo: AssetRepository,
    private storage: StorageProvider,
    private bucket: string,
    private taskService: TaskService,
  ) {}

  async createUploadSession(input: {
    projectId: string;
    kind: AssetKind;
    originalFilename: string;
    sizeBytes: number;
    mimeType: string;
    requestedBy: string;
  }): Promise<{
    uploadId: string;
    url: string;
    requiredHeaders: Record<string, string>;
    expiresAt: string;
  }> {
    const objectKey = `uploads/${input.projectId}/${crypto.randomUUID()}`;
    const expiresAt = new Date(Date.now() + UPLOAD_URL_TTL_SECONDS * 1000);

    const session = await this.repo.createUploadSession({
      projectId: input.projectId,
      bucket: this.bucket,
      objectKey,
      kind: input.kind,
      originalFilename: input.originalFilename,
      mimeType: input.mimeType,
      sizeBytes: input.sizeBytes,
      createdBy: input.requestedBy,
      expiresAt,
    });

    const { url, requiredHeaders } = await this.storage.signUploadUrl({
      bucket: this.bucket,
      key: objectKey,
      contentType: input.mimeType,
      contentLength: input.sizeBytes,
      expiresInSeconds: UPLOAD_URL_TTL_SECONDS,
    });

    return {
      uploadId: session.id,
      url,
      requiredHeaders,
      expiresAt: expiresAt.toISOString(),
    };
  }

  async completeUpload(
    uploadId: string,
    projectId: string,
    requestedBy: string,
    isMemberFn: (projectId: string) => Promise<boolean>,
    projectStatus: string,
  ): Promise<
    | { assetId: string; validationTaskId: string }
    | 'not_found'
    | 'forbidden'
    | 'already_completed'
    | 'expired'
    | 'not_uploaded'
    | 'project_locked'
  > {
    const session = await this.repo.findUploadSession(uploadId);
    if (!session || session.projectId !== projectId) return 'not_found';

    if (!(await isMemberFn(session.projectId))) return 'forbidden';
    if (session.createdBy !== requestedBy) return 'forbidden';
    if (isProjectLocked(projectStatus)) return 'project_locked';

    if (session.status === 'completed' && session.assetId) {
      const asset = await this.repo.findById(session.assetId);
      if (!asset) return 'not_found';
      const idempotencyKey = `asset_validation:${session.assetId}`;
      const taskResult = await this.taskService.enqueueAssetValidation({
        projectId: session.projectId,
        idempotencyKey,
        requestedBy,
        payload: {
          assetId: session.assetId,
          bucket: session.bucket,
          objectKey: session.objectKey,
        },
      });
      const taskId =
        taskResult === 'duplicate'
          ? await this.findValidationTaskId(idempotencyKey)
          : taskResult.id;
      return {
        assetId: session.assetId,
        validationTaskId: taskId ?? 'unknown',
      };
    }

    if (session.status !== 'initiated') return 'already_completed';

    if (session.expiresAt < new Date()) {
      await this.repo.failUploadSession(uploadId);
      return 'expired';
    }

    const head = await this.storage.headObject({
      bucket: session.bucket,
      key: session.objectKey,
    });
    if (!head.exists) return 'not_uploaded';

    const asset = await this.repo.createAsset({
      projectId: session.projectId,
      kind: session.kind,
      bucket: session.bucket,
      objectKey: session.objectKey,
      originalFilename: session.originalFilename,
      mimeType: session.mimeType,
      sizeBytes: Number(session.sizeBytes),
      createdBy: requestedBy,
    });

    await this.repo.completeUploadSession(uploadId, asset.id);

    const idempotencyKey = `asset_validation:${asset.id}`;
    const taskResult = await this.taskService.enqueueAssetValidation({
      projectId: session.projectId,
      idempotencyKey,
      requestedBy,
      payload: {
        assetId: asset.id,
        bucket: session.bucket,
        objectKey: session.objectKey,
      },
    });

    const taskId =
      taskResult === 'duplicate'
        ? await this.findValidationTaskId(idempotencyKey)
        : taskResult.id;

    return { assetId: asset.id, validationTaskId: taskId ?? 'unknown' };
  }

  private async findValidationTaskId(
    _idempotencyKey: string,
  ): Promise<string | null> {
    const result = await this.taskService.listTasks(
      { kind: 'asset_validation', limit: 1 },
      '',
      true,
      async () => true,
    );
    if (result === 'forbidden') return null;
    return result.data[0]?.id ?? null;
  }

  async getAsset(
    assetId: string,
    projectId: string,
    isMemberFn: (projectId: string) => Promise<boolean>,
  ): Promise<Asset | 'not_found' | 'forbidden'> {
    const asset = await this.repo.findById(assetId);
    if (!asset || asset.projectId !== projectId) return 'not_found';
    if (!(await isMemberFn(asset.projectId))) return 'forbidden';
    return toAssetDto(asset);
  }

  async listAssets(
    opts: {
      projectId: string;
      kind?: AssetKind;
      status?: AssetStatus;
      includeHidden?: boolean;
      cursor?: string;
      limit?: number;
    },
    isMemberFn: (projectId: string) => Promise<boolean>,
  ): Promise<
    | { data: Asset[]; page: { nextCursor: string | null; hasMore: boolean } }
    | 'forbidden'
  > {
    if (!(await isMemberFn(opts.projectId))) return 'forbidden';
    const result = await this.repo.list(opts);
    return { data: result.data.map(toAssetDto), page: result.page };
  }

  async hideAsset(
    assetId: string,
    projectId: string,
    requestedBy: string,
    isMemberFn: (projectId: string) => Promise<boolean>,
    projectStatus: string,
  ): Promise<
    'ok' | 'not_found' | 'forbidden' | 'already_hidden' | 'project_locked'
  > {
    const asset = await this.repo.findById(assetId);
    if (!asset || asset.projectId !== projectId) return 'not_found';
    if (!(await isMemberFn(asset.projectId))) return 'forbidden';
    if (isProjectLocked(projectStatus)) return 'project_locked';
    if (asset.hiddenAt) return 'already_hidden';
    const updated = await this.repo.hideAsset(assetId);
    if (!updated) return 'already_hidden';
    return 'ok';
  }

  async createDownloadUrl(
    assetId: string,
    projectId: string,
    variant: 'original' | 'thumbnail' | undefined,
    isMemberFn: (projectId: string) => Promise<boolean>,
  ): Promise<{ url: string; expiresAt: string } | 'not_found' | 'forbidden'> {
    const asset = await this.repo.findById(assetId);
    if (!asset || asset.projectId !== projectId) return 'not_found';
    if (!(await isMemberFn(asset.projectId))) return 'forbidden';

    let targetObjectKey = asset.objectKey;
    let targetBucket = asset.bucket;

    if (variant === 'thumbnail') {
      const thumb = await this.repo.findThumbnailBySourceId(assetId);
      if (thumb) {
        targetObjectKey = thumb.objectKey;
        targetBucket = thumb.bucket;
      }
    }

    const expiresAt = new Date(Date.now() + DOWNLOAD_URL_TTL_SECONDS * 1000);
    const { url } = await this.storage.signDownloadUrl({
      bucket: targetBucket,
      key: targetObjectKey,
      expiresInSeconds: DOWNLOAD_URL_TTL_SECONDS,
    });

    return { url, expiresAt: expiresAt.toISOString() };
  }
}
