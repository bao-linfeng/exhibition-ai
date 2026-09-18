import { createHash } from 'node:crypto';
import { Readable } from 'node:stream';
import type {
  AssetRepository,
  ExportRepository,
  ImageVersionRepository,
  StorageProvider,
  TaskRepository,
} from '@exhibition/backend';
import { logger } from '@exhibition/backend';

const MAX_EXPORT_SIZE_BYTES = 500 * 1024 * 1024;

export interface ExportJobData {
  taskId: string;
  projectId: string;
  exportId: string;
  outboxId: string;
}

type ManifestVersion = {
  versionId: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  sha256: string;
  createdAt: string;
  sequence: number;
};

type ZipEntryMeta = {
  name: Buffer;
  crc: number;
  dataLength: number;
  timestamp: number;
  offset: number;
};

export async function processExport(
  data: ExportJobData,
  deps: {
    taskRepo: TaskRepository;
    exportRepo: ExportRepository;
    imageVersionRepo: ImageVersionRepository;
    assetRepo: AssetRepository;
    storage: StorageProvider;
    bucket: string;
  },
): Promise<void> {
  const { taskId, projectId } = data;
  const { taskRepo, exportRepo, imageVersionRepo, assetRepo, storage, bucket } =
    deps;
  let claimed = false;
  let exportId: string | undefined = data.exportId;

  try {
    const task = await taskRepo.claimForExecution(taskId);
    if (!task) {
      logger.info({ taskId }, 'Task was not claimable, skipping execution');
      return;
    }
    claimed = true;

    const exportRecord = await exportRepo.findByTaskId(taskId);
    if (!exportRecord) throw new Error('Export record not found');
    exportId = exportRecord.id;

    if (
      exportRecord.id !== data.exportId ||
      exportRecord.projectId !== projectId
    ) {
      throw new Error('Export job data does not match export record');
    }

    const exportedAt = new Date();
    const objectKey = `projects/${projectId}/exports/${exportRecord.id}.zip`;
    await storage.putObject({
      bucket,
      key: objectKey,
      body: Readable.from(
        createStreamingZip(
          exportRecord.versionIds,
          imageVersionRepo,
          storage,
          exportedAt,
          projectId,
          MAX_EXPORT_SIZE_BYTES,
        ),
      ),
      contentType: 'application/zip',
    });
    const { contentLength } = await storage.headObject({
      bucket,
      key: objectKey,
    });
    const asset = await assetRepo.createAsset({
      projectId,
      kind: 'export_zip',
      status: 'ready',
      bucket,
      objectKey,
      originalFilename: `export_${exportRecord.id}.zip`,
      mimeType: 'application/zip',
      sizeBytes: contentLength ?? 0,
      createdBy: exportRecord.createdBy,
    });
    await exportRepo.updateStatus(exportRecord.id, 'succeeded', {
      resultAssetId: asset.id,
      finishedAt: new Date(),
    });
    await taskRepo.updateStatus(taskId, 'succeeded', {
      finishedAt: new Date(),
      canCancel: false,
      canRetry: false,
    });

    logger.info(
      {
        taskId,
        exportId: exportRecord.id,
        versionCount: exportRecord.versionIds.length,
      },
      'Export completed',
    );
  } catch (err) {
    logger.error({ taskId, err }, 'Export processing failed');
    if (claimed) {
      await Promise.all([
        exportId
          ? exportRepo.updateStatus(exportId, 'failed', {
              errorMessage: 'Export processing failed',
              finishedAt: new Date(),
            })
          : Promise.resolve(),
        taskRepo.updateStatus(taskId, 'failed', {
          finishedAt: new Date(),
          errorCode: 'EXPORT_FAILED',
          errorMessage: 'Export processing failed',
          canCancel: false,
          canRetry: true,
        }),
      ]);
    }
    throw err;
  }
}

function sanitizeFilename(name: string): string {
  const sanitized = name
    .replace(/[/\\:*?"<>|]/g, '_')
    .replace(/\.\./g, '_')
    .slice(0, 200);
  return sanitized || 'image';
}

async function readObject(
  storage: StorageProvider,
  bucket: string,
  key: string,
  maxSize: number,
): Promise<Buffer> {
  const { body, contentLength } = await storage.getObject({ bucket, key });
  if (contentLength !== undefined && contentLength > maxSize) {
    throw new Error('Export size exceeds 500 MiB');
  }

  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of body) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > maxSize) {
      body.destroy();
      throw new Error('Export size exceeds 500 MiB');
    }
    chunks.push(buffer);
  }
  return Buffer.concat(chunks, size);
}

async function* createStreamingZip(
  versionIds: string[],
  imageVersionRepo: ImageVersionRepository,
  storage: StorageProvider,
  exportedAt: Date,
  projectId: string,
  maxTotalBytes: number,
): AsyncGenerator<Buffer> {
  const timestamp = toDosTimestamp(exportedAt);
  const entries: ZipEntryMeta[] = [];
  const versions: ManifestVersion[] = [];
  let totalSourceSize = 0;
  let offset = 0;

  for (const versionId of versionIds) {
    const location = await imageVersionRepo.findAssetLocation(versionId);
    if (!location) throw new Error(`Image version ${versionId} not found`);

    if (location.sizeBytes > maxTotalBytes - totalSourceSize) {
      throw new Error('Export size exceeds 500 MiB');
    }

    const image = await readObject(
      storage,
      location.bucket,
      location.objectKey,
      maxTotalBytes - totalSourceSize,
    );
    totalSourceSize += image.length;
    const filename = `${String(location.sequence).padStart(3, '0')}_${sanitizeFilename(
      location.originalFilename,
    )}`;
    const name = Buffer.from(filename, 'utf8');
    const entry: ZipEntryMeta = {
      name,
      crc: crc32(image),
      dataLength: image.length,
      timestamp,
      offset,
    };
    entries.push(entry);
    versions.push({
      versionId,
      filename,
      mimeType: location.mimeType,
      sizeBytes: image.length,
      sha256: createHash('sha256').update(image).digest('hex'),
      createdAt: location.createdAt.toISOString(),
      sequence: location.sequence,
    });

    yield createLocalFileHeader(entry);
    yield name;
    yield image;
    offset += 30 + name.length + image.length;
  }

  const manifest = Buffer.from(
    JSON.stringify({
      exportedAt: exportedAt.toISOString(),
      projectId,
      versions,
    }),
    'utf8',
  );
  const manifestEntry: ZipEntryMeta = {
    name: Buffer.from('manifest.json', 'utf8'),
    crc: crc32(manifest),
    dataLength: manifest.length,
    timestamp,
    offset,
  };
  entries.push(manifestEntry);
  const finalSize =
    offset +
    30 +
    manifestEntry.name.length +
    manifest.length +
    entries.reduce((size, entry) => size + 46 + entry.name.length, 0) +
    22;
  if (finalSize > maxTotalBytes) {
    throw new Error('Export size exceeds 500 MiB');
  }

  yield createLocalFileHeader(manifestEntry);
  yield manifestEntry.name;
  yield manifest;
  offset += 30 + manifestEntry.name.length + manifest.length;

  const centralDirectoryOffset = offset;
  for (const entry of entries) {
    yield createCentralDirHeader(entry);
    yield entry.name;
    offset += 46 + entry.name.length;
  }

  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(offset - centralDirectoryOffset, 12);
  end.writeUInt32LE(centralDirectoryOffset, 16);
  yield end;
}

function createLocalFileHeader(entry: ZipEntryMeta): Buffer {
  const header = Buffer.alloc(30);
  header.writeUInt32LE(0x04034b50, 0);
  header.writeUInt16LE(20, 4);
  header.writeUInt16LE(0x0800, 6);
  header.writeUInt16LE(0, 8);
  header.writeUInt32LE(entry.timestamp, 10);
  header.writeUInt32LE(entry.crc, 14);
  header.writeUInt32LE(entry.dataLength, 18);
  header.writeUInt32LE(entry.dataLength, 22);
  header.writeUInt16LE(entry.name.length, 26);
  return header;
}

function createCentralDirHeader(entry: ZipEntryMeta): Buffer {
  const header = Buffer.alloc(46);
  header.writeUInt32LE(0x02014b50, 0);
  header.writeUInt16LE(20, 4);
  header.writeUInt16LE(20, 6);
  header.writeUInt16LE(0x0800, 8);
  header.writeUInt16LE(0, 10);
  header.writeUInt32LE(entry.timestamp, 12);
  header.writeUInt32LE(entry.crc, 16);
  header.writeUInt32LE(entry.dataLength, 20);
  header.writeUInt32LE(entry.dataLength, 24);
  header.writeUInt16LE(entry.name.length, 28);
  header.writeUInt32LE(entry.offset, 42);
  return header;
}

function toDosTimestamp(date: Date): number {
  const year = Math.max(date.getFullYear(), 1980) - 1980;
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const time =
    (date.getHours() << 11) |
    (date.getMinutes() << 5) |
    (date.getSeconds() >> 1);
  const calendar = (year << 9) | (month << 5) | day;
  return ((calendar << 16) | time) >>> 0;
}

function crc32(buffer: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc = (crc >>> 8) ^ CRC32_TABLE[(crc ^ byte) & 0xff]!;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

const CRC32_TABLE = Uint32Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit++) {
    value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }
  return value >>> 0;
});
