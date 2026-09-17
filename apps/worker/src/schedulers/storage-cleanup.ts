import type {
  AssetRepository,
  ExportRepository,
  StorageProvider,
} from '@exhibition/backend';
import { logger } from '@exhibition/backend';

const UPLOAD_SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export async function runStorageCleanup(deps: {
  assetRepo: AssetRepository;
  exportRepo: ExportRepository;
  storage: StorageProvider;
  bucket: string;
}): Promise<void> {
  const { assetRepo, exportRepo, storage, bucket } = deps;

  // 1. 清理过期上传会话：initiated 状态超 24 小时的临时对象
  try {
    const cutoff = new Date(Date.now() - UPLOAD_SESSION_TTL_MS);
    const expiredSessions = await assetRepo.findExpiredUploadSessions(cutoff);
    let cleaned = 0;
    for (const session of expiredSessions) {
      try {
        await storage.deleteObject({
          bucket: session.bucket,
          key: session.objectKey,
        });
        cleaned++;
      } catch (err) {
        logger.warn(
          { err, sessionId: session.id, objectKey: session.objectKey },
          'Failed to delete orphaned upload object; skipping',
        );
      }
      await assetRepo.markUploadSessionExpired(session.id);
    }
    if (expiredSessions.length > 0) {
      logger.info(
        { total: expiredSessions.length, cleaned },
        'Cleaned up expired upload sessions',
      );
    }
  } catch (err) {
    logger.error({ err }, 'Storage cleanup: upload session phase failed');
  }

  // 2. 清理过期 ZIP 导出文件：expiresAt 已过期且有关联资产的 export_records
  try {
    const now = new Date();
    const expiredExports = await exportRepo.findExpiredWithAsset(now);
    let cleaned = 0;
    for (const record of expiredExports) {
      if (!record.resultAssetId) continue;
      try {
        const asset = await assetRepo.findById(record.resultAssetId);
        if (asset) {
          await storage.deleteObject({
            bucket: asset.bucket,
            key: asset.objectKey,
          });
          cleaned++;
        }
      } catch (err) {
        logger.warn(
          { err, exportId: record.id, resultAssetId: record.resultAssetId },
          'Failed to delete expired ZIP export object; skipping',
        );
      }
    }
    if (expiredExports.length > 0) {
      logger.info(
        { total: expiredExports.length, cleaned },
        'Cleaned up expired ZIP exports',
      );
    }
  } catch (err) {
    logger.error({ err }, 'Storage cleanup: ZIP export phase failed');
  }

  // 3. 过期会话（sessions）由数据库的 expiresAt 字段管理，不需要对象存储清理
  // 过期 SSE 事件（project_events）无对应对象存储资产，保留策略通过 RUNBOOK 记录

  logger.debug('Storage cleanup cycle complete');

  void bucket; // suppress unused warning — bucket passed to deps but referenced via session.bucket
}
