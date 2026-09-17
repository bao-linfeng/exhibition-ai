#!/usr/bin/env bash
# 必须从项目根目录运行：bash infra/scripts/backup.sh
# 用法：
#   BACKUP_DIR=/backups bash infra/scripts/backup.sh
#   IMAGE_TAG=v1.2.3 BACKUP_DIR=/backups bash infra/scripts/backup.sh
#
# 保留策略（符合 §11.5 / T030 AC-16）：
#   - 日备份：保留最近 7 份
#   - 周备份（每周日运行时触发）：保留最近 4 份
#
# 备份内容：
#   1. PostgreSQL dump（pg_dump）
#   2. RustFS/S3 对象存储（mc mirror）
#   3. SHA-256 校验清单
set -euo pipefail

COMPOSE="docker compose --env-file .env -f infra/compose.dev.yaml"
BACKUP_DIR="${BACKUP_DIR:-/tmp/exhibition-backups}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
DAY_OF_WEEK=$(date +%u)  # 1=Mon ... 7=Sun
BACKUP_NAME="backup_${TIMESTAMP}"
BACKUP_PATH="${BACKUP_DIR}/daily/${BACKUP_NAME}"
WEEKLY_RETENTION=4
DAILY_RETENTION=7

mkdir -p "${BACKUP_PATH}"

echo "==> [backup] 开始备份 ${BACKUP_NAME}"

# ---------- 1. PostgreSQL dump ----------
echo "==> [backup][1/3] 导出 PostgreSQL..."
$COMPOSE exec -T postgres pg_dump \
  -U "${PGUSER:-exhibition}" \
  -d "${PGDATABASE:-exhibition}" \
  --format=custom \
  --no-password \
  > "${BACKUP_PATH}/postgres.dump"
echo "    PostgreSQL dump 完成"

# ---------- 2. 对象存储（使用 mc 命令行工具通过 S3 API 镜像）----------
echo "==> [backup][2/3] 镜像对象存储..."

# 尝试通过 mc（MinIO Client）进行镜像备份；若未安装则用 AWS CLI
if command -v mc &>/dev/null; then
  mc alias set backup-src \
    "${S3_ENDPOINT:-http://localhost:19000}" \
    "${S3_ACCESS_KEY:-}" \
    "${S3_SECRET_KEY:-}" \
    --api s3v4 \
    --quiet 2>/dev/null || true
  mc mirror "backup-src/${S3_BUCKET:-exhibition}" "${BACKUP_PATH}/objects/" \
    --overwrite --quiet || {
    echo "WARN: mc mirror 失败，跳过对象存储备份"
  }
elif command -v aws &>/dev/null; then
  AWS_ACCESS_KEY_ID="${S3_ACCESS_KEY:-}" \
  AWS_SECRET_ACCESS_KEY="${S3_SECRET_KEY:-}" \
  aws s3 sync \
    "s3://${S3_BUCKET:-exhibition}" \
    "${BACKUP_PATH}/objects/" \
    --endpoint-url "${S3_ENDPOINT:-http://localhost:19000}" \
    --no-progress || {
    echo "WARN: aws s3 sync 失败，跳过对象存储备份"
  }
else
  echo "WARN: 未找到 mc 或 aws 工具，跳过对象存储备份"
  echo "      请安装 MinIO Client (mc) 或 AWS CLI 以启用对象存储备份"
fi
echo "    对象存储镜像完成"

# ---------- 3. 生成 SHA-256 校验清单 ----------
echo "==> [backup][3/3] 生成 SHA-256 校验清单..."
(
  cd "${BACKUP_PATH}"
  find . -type f ! -name "SHA256SUMS" | sort | xargs sha256sum > SHA256SUMS
)
echo "    校验清单生成完成"

# ---------- 周备份符号链接 ----------
if [ "$DAY_OF_WEEK" -eq 7 ]; then
  echo "==> [backup] 今天是周日，创建周备份软链..."
  WEEKLY_DIR="${BACKUP_DIR}/weekly"
  mkdir -p "${WEEKLY_DIR}"
  ln -sfn "${BACKUP_PATH}" "${WEEKLY_DIR}/${BACKUP_NAME}"
  echo "    周备份链接：${WEEKLY_DIR}/${BACKUP_NAME}"

  # 清理超过 WEEKLY_RETENTION 的周备份
  WEEKLY_COUNT=$(ls -1 "${WEEKLY_DIR}" | wc -l)
  if [ "$WEEKLY_COUNT" -gt "$WEEKLY_RETENTION" ]; then
    ls -1t "${WEEKLY_DIR}" | tail -n "+$((WEEKLY_RETENTION + 1))" | while read -r OLD; do
      TARGET=$(readlink -f "${WEEKLY_DIR}/${OLD}" 2>/dev/null || echo "")
      rm -f "${WEEKLY_DIR}/${OLD}"
      echo "    已删除周备份链接：${OLD}"
      # 若实际备份目录不再被任何周备份链接引用，则一并删除
      if [ -n "$TARGET" ] && [ -d "$TARGET" ]; then
        STILL_LINKED=$(find "${WEEKLY_DIR}" -type l -exec readlink -f {} \; 2>/dev/null | grep -c "^${TARGET}$" || true)
        if [ "${STILL_LINKED:-0}" -eq 0 ]; then
          rm -rf "$TARGET"
          echo "    已删除孤立备份目录：${TARGET}"
        fi
      fi
    done
  fi
fi

# ---------- 清理超过 DAILY_RETENTION 的日备份 ----------
DAILY_DIR="${BACKUP_DIR}/daily"
DAILY_COUNT=$(ls -1 "${DAILY_DIR}" | wc -l)
if [ "$DAILY_COUNT" -gt "$DAILY_RETENTION" ]; then
  ls -1t "${DAILY_DIR}" | tail -n "+$((DAILY_RETENTION + 1))" | while read -r OLD; do
    rm -rf "${DAILY_DIR}/${OLD}"
    echo "==> [backup] 已删除旧日备份：${OLD}"
  done
fi

# ---------- 更新备份时间戳标记（供 check-alerts.sh 监测）----------
date +%s > /tmp/last-backup-time

echo "==> [backup] 备份完成：${BACKUP_PATH}"
echo "==> [backup] 校验清单：${BACKUP_PATH}/SHA256SUMS"
