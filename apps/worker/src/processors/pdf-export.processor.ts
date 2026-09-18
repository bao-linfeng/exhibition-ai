import { Readable } from 'node:stream';
import { PDFDocument, StandardFonts, rgb, type PDFFont } from 'pdf-lib';
import sharp from 'sharp';
import type {
  AssetRepository,
  ExportRepository,
  ImageVersionRepository,
  StorageProvider,
  TaskRepository,
} from '@exhibition/backend';
import { logger } from '@exhibition/backend';
import type { ExportJobData } from './export.processor.js';

const MAX_EXPORT_SIZE_BYTES = 500 * 1024 * 1024;
const MAX_IMAGE_DIMENSION = 2000;
const PAGE_PADDING = 36;
const FOOTER_HEIGHT = 28;

type ImageLocation = {
  versionId: string;
  filename: string;
  sequence: number;
  bucket: string;
  objectKey: string;
  sizeBytes: number;
};

export async function processPdfExport(
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
    const locations: ImageLocation[] = [];

    for (const versionId of exportRecord.versionIds) {
      const location = await imageVersionRepo.findAssetLocation(versionId);
      if (!location) throw new Error(`Image version ${versionId} not found`);

      if (location.sizeBytes > MAX_EXPORT_SIZE_BYTES - totalSourceSize) {
        throw new Error('Export size exceeds 500 MiB');
      }

      totalSourceSize += location.sizeBytes;
      locations.push({
        versionId,
        filename: toPdfFilename(location.originalFilename),
        sequence: location.sequence,
        bucket: location.bucket,
        objectKey: location.objectKey,
        sizeBytes: location.sizeBytes,
      });
    }

    locations.sort((a, b) => a.sequence - b.sequence);

    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    drawCoverPage(pdfDoc, font, projectId, exportedAt);

    let actualSourceSize = 0;
    const versionIds: string[] = [];
    for (const location of locations) {
      const imageData = await readObject(
        storage,
        location.bucket,
        location.objectKey,
        MAX_EXPORT_SIZE_BYTES - actualSourceSize,
      );
      actualSourceSize += imageData.length;
      await drawImagePage(
        pdfDoc,
        font,
        { sequence: location.sequence, filename: location.filename },
        imageData,
      );
      versionIds.push(location.versionId);
    }
    drawSourcePage(pdfDoc, font, versionIds);

    const pdf = await pdfDoc.save();
    if (pdf.length > MAX_EXPORT_SIZE_BYTES) {
      throw new Error('Export size exceeds 500 MiB');
    }

    const objectKey = `projects/${projectId}/exports/${exportRecord.id}.pdf`;
    await storage.putObject({
      bucket,
      key: objectKey,
      body: Readable.from(Buffer.from(pdf)),
      contentType: 'application/pdf',
      contentLength: pdf.length,
    });
    const asset = await assetRepo.createAsset({
      projectId,
      kind: 'export_pdf',
      status: 'ready',
      bucket,
      objectKey,
      originalFilename: `export_${exportRecord.id}.pdf`,
      mimeType: 'application/pdf',
      sizeBytes: pdf.length,
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
      { taskId, exportId: exportRecord.id, versionCount: locations.length },
      'PDF export completed',
    );
  } catch (err) {
    logger.error({ taskId, err }, 'PDF export processing failed');
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

function drawCoverPage(
  pdfDoc: PDFDocument,
  font: PDFFont,
  projectId: string,
  exportedAt: Date,
): void {
  const page = pdfDoc.addPage([612, 792]);
  page.drawText('Proposal Export', {
    x: 72,
    y: 650,
    size: 30,
    font,
    color: rgb(0.1, 0.1, 0.1),
  });
  page.drawText(`Project ID: ${projectId}`, {
    x: 72,
    y: 590,
    size: 14,
    font,
    color: rgb(0.2, 0.2, 0.2),
  });
  page.drawText(`Exported at (UTC): ${exportedAt.toISOString()}`, {
    x: 72,
    y: 560,
    size: 14,
    font,
    color: rgb(0.2, 0.2, 0.2),
  });
}

async function drawImagePage(
  pdfDoc: PDFDocument,
  font: PDFFont,
  source: { sequence: number; filename: string },
  data: Buffer,
): Promise<void> {
  const image = sharp(data);
  const metadata = await image.metadata();
  const jpeg = await (
    metadata.width &&
    metadata.height &&
    (metadata.width > MAX_IMAGE_DIMENSION ||
      metadata.height > MAX_IMAGE_DIMENSION)
      ? image.resize(MAX_IMAGE_DIMENSION, MAX_IMAGE_DIMENSION, {
          fit: 'inside',
        })
      : image
  )
    .jpeg({ quality: 85 })
    .toBuffer();
  const embedded = await pdfDoc.embedJpg(jpeg);
  const imageWidth = embedded.width;
  const imageHeight = embedded.height;
  const pageWidth = Math.min(
    MAX_IMAGE_DIMENSION,
    Math.max(200, imageWidth + PAGE_PADDING * 2),
  );
  const pageHeight = Math.min(
    MAX_IMAGE_DIMENSION,
    Math.max(200, imageHeight + PAGE_PADDING + FOOTER_HEIGHT),
  );
  const maxWidth = pageWidth - PAGE_PADDING * 2;
  const maxHeight = pageHeight - PAGE_PADDING - FOOTER_HEIGHT;
  const scale = Math.min(maxWidth / imageWidth, maxHeight / imageHeight, 1);
  const width = imageWidth * scale;
  const height = imageHeight * scale;
  const page = pdfDoc.addPage([pageWidth, pageHeight]);

  page.drawImage(embedded, {
    x: (pageWidth - width) / 2,
    y: FOOTER_HEIGHT + (maxHeight - height) / 2,
    width,
    height,
  });
  page.drawText(
    `${String(source.sequence).padStart(3, '0')} - ${source.filename}`,
    {
      x: PAGE_PADDING,
      y: 10,
      size: 10,
      font,
      color: rgb(0.25, 0.25, 0.25),
      maxWidth,
    },
  );
}

function drawSourcePage(
  pdfDoc: PDFDocument,
  font: PDFFont,
  versionIds: string[],
): void {
  const page = pdfDoc.addPage([612, 792]);
  page.drawText('Source Information', {
    x: 72,
    y: 720,
    size: 22,
    font,
    color: rgb(0.1, 0.1, 0.1),
  });
  page.drawText('Version IDs:', {
    x: 72,
    y: 685,
    size: 12,
    font,
    color: rgb(0.2, 0.2, 0.2),
  });

  const lineHeight = 14;
  let y = 660;
  for (const versionId of versionIds) {
    page.drawText(versionId, {
      x: 84,
      y,
      size: 10,
      font,
      color: rgb(0.2, 0.2, 0.2),
    });
    y -= lineHeight;
  }
}

function toPdfFilename(filename: string): string {
  const safe = filename
    .replace(/[/\\:*?"<>|]/g, '_')
    .replace(/[^\x20-\x7e]/g, '_')
    .slice(0, 180);
  return safe || 'image';
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
