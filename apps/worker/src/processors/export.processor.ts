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

type ExportFile = {
  filename: string;
  data: Buffer;
};

type ManifestVersion = {
  versionId: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  sha256: string;
  createdAt: string;
  sequence: number;
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
    let totalSourceSize = 0;
    const files: ExportFile[] = [];
    const versions: ManifestVersion[] = [];

    for (const versionId of exportRecord.versionIds) {
      const location = await imageVersionRepo.findAssetLocation(versionId);
      if (!location) throw new Error(`Image version ${versionId} not found`);

      if (location.sizeBytes > MAX_EXPORT_SIZE_BYTES - totalSourceSize) {
        throw new Error('Export size exceeds 500 MiB');
      }

      const image = await readObject(
        storage,
        location.bucket,
        location.objectKey,
        MAX_EXPORT_SIZE_BYTES - totalSourceSize,
      );
      totalSourceSize += image.length;
      const filename = `${String(location.sequence).padStart(3, '0')}_${sanitizeFilename(
        location.originalFilename,
      )}`;
      const sha256 = createHash('sha256').update(image).digest('hex');

      files.push({ filename, data: image });
      versions.push({
        versionId,
        filename,
        mimeType: location.mimeType,
        sizeBytes: image.length,
        sha256,
        createdAt: location.createdAt.toISOString(),
        sequence: location.sequence,
      });
    }

    const manifest = Buffer.from(
      JSON.stringify({
        exportedAt: exportedAt.toISOString(),
        projectId,
        versions,
      }),
      'utf8',
    );
    const zipFiles = [...files, { filename: 'manifest.json', data: manifest }];
    const zipSize = getStoredZipSize(zipFiles);
    if (zipSize > MAX_EXPORT_SIZE_BYTES) {
      throw new Error('Export size exceeds 500 MiB');
    }

    const objectKey = `projects/${projectId}/exports/${exportRecord.id}.zip`;
    await storage.putObject({
      bucket,
      key: objectKey,
      body: Readable.from(createStoredZip(zipFiles)),
      contentType: 'application/zip',
      contentLength: zipSize,
    });
    const asset = await assetRepo.createAsset({
      projectId,
      kind: 'export_zip',
      status: 'ready',
      bucket,
      objectKey,
      originalFilename: `export_${exportRecord.id}.zip`,
      mimeType: 'application/zip',
      sizeBytes: zipSize,
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
      { taskId, exportId: exportRecord.id, versionCount: versions.length },
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

function* createStoredZip(files: ExportFile[]): Generator<Buffer> {
  const timestamp = toDosTimestamp(new Date());
  const entries = files.map((file) => toZipEntry(file, timestamp));
  let offset = 0;

  for (const entry of entries) {
    entry.offset = offset;
    yield createLocalHeader(entry);
    yield entry.name;
    yield entry.data;
    offset += 30 + entry.name.length + entry.data.length;
  }

  const centralDirectoryOffset = offset;
  for (const entry of entries) {
    yield createCentralDirectoryHeader(entry, entry.offset);
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

function getStoredZipSize(files: ExportFile[]): number {
  const entrySize = files.reduce((size, file) => {
    return size + 76 + Buffer.byteLength(file.filename) + file.data.length;
  }, 0);
  return entrySize + 22;
}

function toZipEntry(file: ExportFile, timestamp: number) {
  return {
    name: Buffer.from(file.filename, 'utf8'),
    data: file.data,
    crc: crc32(file.data),
    timestamp,
    offset: 0,
  };
}

function createLocalHeader(entry: ReturnType<typeof toZipEntry>): Buffer {
  const header = Buffer.alloc(30);
  header.writeUInt32LE(0x04034b50, 0);
  header.writeUInt16LE(20, 4);
  header.writeUInt16LE(0x0800, 6);
  header.writeUInt16LE(0, 8);
  header.writeUInt32LE(entry.timestamp, 10);
  header.writeUInt32LE(entry.crc, 14);
  header.writeUInt32LE(entry.data.length, 18);
  header.writeUInt32LE(entry.data.length, 22);
  header.writeUInt16LE(entry.name.length, 26);
  return header;
}

function createCentralDirectoryHeader(
  entry: ReturnType<typeof toZipEntry>,
  offset: number,
): Buffer {
  const header = Buffer.alloc(46);
  header.writeUInt32LE(0x02014b50, 0);
  header.writeUInt16LE(20, 4);
  header.writeUInt16LE(20, 6);
  header.writeUInt16LE(0x0800, 8);
  header.writeUInt16LE(0, 10);
  header.writeUInt32LE(entry.timestamp, 12);
  header.writeUInt32LE(entry.crc, 16);
  header.writeUInt32LE(entry.data.length, 20);
  header.writeUInt32LE(entry.data.length, 24);
  header.writeUInt16LE(entry.name.length, 28);
  header.writeUInt32LE(offset, 42);
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
