import type { ExportTask } from '@exhibition/contracts';
import type { Database, ExportRecord } from '@exhibition/db';
import type { Queue } from 'bullmq';
import { QUEUE_EXPORT } from '../../infrastructure/queue.js';
import type { StorageProvider } from '../../infrastructure/storage.js';
import type { AssetRepository } from '../assets/assets.repository.js';
import type { TaskRepository } from '../tasks/tasks.repository.js';
import type { ExportRepository } from './exports.repository.js';

const EXPORT_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const DOWNLOAD_URL_TTL_SECONDS = 900;

function toExportDto(row: ExportRecord): ExportTask {
  return {
    id: row.id,
    projectId: row.projectId,
    format: row.format as 'zip' | 'pdf',
    versionIds: row.versionIds,
    status: row.status as ExportTask['status'],
    resultAssetId: row.resultAssetId,
    errorMessage: row.errorMessage,
    createdBy: row.createdBy,
    createdAt: row.createdAt.toISOString(),
    finishedAt: row.finishedAt?.toISOString() ?? null,
  };
}

export class ExportService {
  constructor(
    private db: Database,
    private repo: ExportRepository,
    private taskRepo: TaskRepository,
    private assetRepo: AssetRepository,
    private storage: StorageProvider,
    private bucket: string,
    private queues: Map<string, Queue>,
  ) {}

  async createExport(
    input: {
      projectId: string;
      versionIds: string[];
      format: 'zip' | 'pdf';
      requestedBy: string;
    },
    isMemberFn: (projectId: string) => Promise<boolean>,
  ): Promise<
    | { exportId: string; taskId: string; status: 'pending' }
    | 'forbidden'
    | 'versions_not_found'
    | 'too_many_versions'
  > {
    if (!(await isMemberFn(input.projectId))) return 'forbidden';
    if (input.versionIds.length > 20) return 'too_many_versions';
    if (
      !(await this.repo.validateVersionsBelongToProject(
        input.versionIds,
        input.projectId,
      ))
    ) {
      return 'versions_not_found';
    }

    const { task, outbox, record } = await this.db.transaction(async (tx) => {
      const { task, outbox } = await this.taskRepo.createWithOutboxInTx(tx, {
        projectId: input.projectId,
        kind: 'export',
        requestedBy: input.requestedBy,
        queueName: QUEUE_EXPORT,
        payload: { projectId: input.projectId },
      });
      const record = await this.repo.createInTx(tx, {
        projectId: input.projectId,
        taskId: task.id,
        format: input.format,
        versionIds: input.versionIds,
        createdBy: input.requestedBy,
        expiresAt: new Date(Date.now() + EXPORT_TTL_MS),
      });
      const payload = {
        taskId: task.id,
        projectId: input.projectId,
        exportId: record.id,
        outboxId: outbox.id,
      };
      await this.repo.updateOutboxPayloadInTx(tx, outbox.id, payload);

      return { task, outbox: { ...outbox, payload }, record };
    });

    await this.relayOutbox(
      outbox.id,
      task.id,
      outbox.payload as Record<string, unknown>,
    );

    return { exportId: record.id, taskId: task.id, status: 'pending' };
  }

  async getExport(
    exportId: string,
    projectId: string,
    isMemberFn: (projectId: string) => Promise<boolean>,
  ): Promise<ExportTask | 'not_found' | 'forbidden'> {
    const record = await this.repo.findById(exportId);
    if (!record || record.projectId !== projectId) return 'not_found';
    if (!(await isMemberFn(record.projectId))) return 'forbidden';
    return toExportDto(record);
  }

  async listExports(
    opts: { projectId: string; cursor?: string; limit?: number },
    isMemberFn: (projectId: string) => Promise<boolean>,
  ): Promise<
    | {
        data: ExportTask[];
        page: { nextCursor: string | null; hasMore: boolean };
      }
    | 'forbidden'
  > {
    if (!(await isMemberFn(opts.projectId))) return 'forbidden';
    const result = await this.repo.list(opts);
    return { data: result.data.map(toExportDto), page: result.page };
  }

  async getDownloadUrl(
    exportId: string,
    projectId: string,
    isMemberFn: (projectId: string) => Promise<boolean>,
  ): Promise<
    { url: string; expiresAt: string } | 'not_found' | 'forbidden' | 'not_ready'
  > {
    const record = await this.repo.findById(exportId);
    if (!record || record.projectId !== projectId) return 'not_found';
    if (!(await isMemberFn(record.projectId))) return 'forbidden';
    if (record.status !== 'succeeded' || !record.resultAssetId)
      return 'not_ready';

    const asset = await this.assetRepo.findById(record.resultAssetId);
    if (
      !asset ||
      asset.projectId !== record.projectId ||
      asset.status !== 'ready'
    ) {
      return 'not_ready';
    }

    const expiresAt = new Date(Date.now() + DOWNLOAD_URL_TTL_SECONDS * 1000);
    const { url } = await this.storage.signDownloadUrl({
      bucket: asset.bucket || this.bucket,
      key: asset.objectKey,
      expiresInSeconds: DOWNLOAD_URL_TTL_SECONDS,
    });
    return { url, expiresAt: expiresAt.toISOString() };
  }

  private async relayOutbox(
    outboxId: string,
    taskId: string,
    payload: Record<string, unknown>,
  ) {
    const queue = this.queues.get(QUEUE_EXPORT);
    if (!queue) return;
    try {
      await queue.add('process', payload, {
        jobId: outboxId,
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
      });
      await this.taskRepo.markOutboxPublished(outboxId);
      await this.taskRepo.markQueuedIfPending(taskId);
    } catch {
      await this.taskRepo.incrementOutboxAttempt(outboxId);
    }
  }
}
