import { createHash } from 'node:crypto';
import { Readable } from 'node:stream';
import type {
  AssetRepository,
  StorageProvider,
  TaskRepository,
} from '@exhibition/backend';
import { logger } from '@exhibition/backend';
import sharp from 'sharp';

const MAX_SIZE_BYTES = 26_214_400;
const MAX_PIXELS = 40_000_000;
const PROJECT_QUOTA_BYTES = 2_147_483_648;
const THUMBNAIL_SIZE = 512;
const ALLOWED_MIME = new Set(['image/png', 'image/jpeg', 'image/webp']);

export interface AssetValidationJobData {
  taskId: string;
  assetId: string;
  bucket: string;
  objectKey: string;
  projectId: string;
}

export async function processAssetValidation(
  data: AssetValidationJobData,
  deps: {
    assetRepo: AssetRepository;
    taskRepo: TaskRepository;
    storage: StorageProvider;
    bucket: string;
  },
): Promise<void> {
  const { taskId, assetId, bucket, objectKey, projectId } = data;
  const { assetRepo, taskRepo, storage } = deps;

  await assetRepo.updateStatus(assetId, 'validating');
  await taskRepo.updateStatus(taskId, 'running', { startedAt: new Date() });

  try {
    const { body, contentLength } = await storage.getObject({
      bucket,
      key: objectKey,
    });
    if (contentLength !== undefined && contentLength > MAX_SIZE_BYTES) {
      await rejectAsset(assetId, taskId, assetRepo, taskRepo, 'FILE_TOO_LARGE');
      return;
    }

    const chunks: Buffer[] = [];
    const stream = body instanceof Readable ? body : Readable.from(body);
    for await (const chunk of stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    const fileBuffer = Buffer.concat(chunks);

    if (fileBuffer.length > MAX_SIZE_BYTES) {
      await rejectAsset(assetId, taskId, assetRepo, taskRepo, 'FILE_TOO_LARGE');
      return;
    }

    let metadata: sharp.Metadata;
    try {
      metadata = await sharp(fileBuffer).metadata();
    } catch {
      await rejectAsset(assetId, taskId, assetRepo, taskRepo, 'INVALID_IMAGE');
      return;
    }

    const detectedMime = formatToMime(metadata.format);
    if (!detectedMime || !ALLOWED_MIME.has(detectedMime)) {
      await rejectAsset(
        assetId,
        taskId,
        assetRepo,
        taskRepo,
        'UNSUPPORTED_FORMAT',
      );
      return;
    }

    const width = metadata.width ?? 0;
    const height = metadata.height ?? 0;
    if (width * height > MAX_PIXELS) {
      await rejectAsset(
        assetId,
        taskId,
        assetRepo,
        taskRepo,
        'TOO_MANY_PIXELS',
      );
      return;
    }

    const projectUsage = await assetRepo.getProjectUsageBytes(
      projectId,
      assetId,
    );
    if (projectUsage + fileBuffer.length > PROJECT_QUOTA_BYTES) {
      await rejectAsset(
        assetId,
        taskId,
        assetRepo,
        taskRepo,
        'PROJECT_QUOTA_EXCEEDED',
      );
      return;
    }

    const sha256 = createHash('sha256').update(fileBuffer).digest('hex');
    const ext = mimeToExt(detectedMime);
    const permanentKey = `projects/${projectId}/assets/${sha256}.${ext}`;
    await storage.putObject({
      bucket: deps.bucket,
      key: permanentKey,
      body: fileBuffer,
      contentType: detectedMime,
      contentLength: fileBuffer.length,
    });

    const thumbnailBuffer = await sharp(fileBuffer)
      .resize(THUMBNAIL_SIZE, THUMBNAIL_SIZE, {
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({ quality: 80 })
      .toBuffer();
    const thumbnailKey = `projects/${projectId}/thumbnails/${sha256}.webp`;
    await storage.putObject({
      bucket: deps.bucket,
      key: thumbnailKey,
      body: thumbnailBuffer,
      contentType: 'image/webp',
      contentLength: thumbnailBuffer.length,
    });

    await assetRepo.updateStatusAndKey(assetId, 'ready', {
      sha256,
      width,
      height,
      objectKey: permanentKey,
    });

    const asset = await assetRepo.findById(assetId);
    if (!asset) throw new Error('Asset not found after validation');
    await assetRepo.createAsset({
      projectId,
      kind: 'thumbnail',
      bucket: deps.bucket,
      objectKey: thumbnailKey,
      originalFilename: `thumb_${sha256}.webp`,
      mimeType: 'image/webp',
      sizeBytes: thumbnailBuffer.length,
      createdBy: asset.createdBy,
      sourceAssetId: assetId,
    });

    await taskRepo.updateStatus(taskId, 'succeeded', {
      finishedAt: new Date(),
      canCancel: false,
      canRetry: false,
    });

    logger.info(
      { taskId, assetId, sha256, width, height },
      'Asset validation succeeded',
    );
  } catch (err) {
    logger.error({ taskId, assetId, err }, 'Asset validation error');
    await rejectAsset(assetId, taskId, assetRepo, taskRepo, 'INTERNAL_ERROR');
    throw err;
  }
}

async function rejectAsset(
  assetId: string,
  taskId: string,
  assetRepo: AssetRepository,
  taskRepo: TaskRepository,
  errorCode: string,
) {
  await assetRepo.updateStatus(assetId, 'rejected');
  await taskRepo.updateStatus(taskId, 'failed', {
    finishedAt: new Date(),
    errorCode,
    errorMessage: `Asset validation failed: ${errorCode}`,
    canCancel: false,
    canRetry: true,
  });
}

function formatToMime(format: string | undefined): string | null {
  switch (format) {
    case 'png':
      return 'image/png';
    case 'jpeg':
      return 'image/jpeg';
    case 'webp':
      return 'image/webp';
    default:
      return null;
  }
}

function mimeToExt(mime: string): string {
  switch (mime) {
    case 'image/png':
      return 'png';
    case 'image/jpeg':
      return 'jpg';
    case 'image/webp':
      return 'webp';
    default:
      return 'bin';
  }
}
