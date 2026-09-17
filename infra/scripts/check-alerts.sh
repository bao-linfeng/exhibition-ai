#!/usr/bin/env bash
set -euo pipefail

COMPOSE="docker compose --env-file .env -f infra/compose.prod.yaml"
ALERT=0

# 1. Outbox 积压 > 60 秒
echo "==> 检测 Outbox 积压..."
OUTBOX_COUNT=$($COMPOSE exec -T postgres psql -U "${PGUSER:-exhibition}" -d "${PGDATABASE:-exhibition}" -t -c \
  "SELECT COUNT(*) FROM tasks WHERE status = 'pending' AND created_at < NOW() - INTERVAL '60 seconds';" 2>/dev/null | tr -d ' ')
if [ "${OUTBOX_COUNT:-0}" -gt 0 ]; then
  echo "ALERT: Outbox 积压 ${OUTBOX_COUNT} 条超过 60 秒"
  ALERT=1
fi

# 2. 调和任务 > 15 分钟
echo "==> 检测 reconciling 任务..."
RECONCILE_COUNT=$($COMPOSE exec -T postgres psql -U "${PGUSER:-exhibition}" -d "${PGDATABASE:-exhibition}" -t -c \
  "SELECT COUNT(*) FROM tasks WHERE status IN ('running','reconciling') AND updated_at < NOW() - INTERVAL '15 minutes';" 2>/dev/null | tr -d ' ')
if [ "${RECONCILE_COUNT:-0}" -gt 0 ]; then
  echo "ALERT: ${RECONCILE_COUNT} 个任务 reconciling 超过 15 分钟"
  ALERT=1
fi

# 3. 磁盘使用 > 80%
echo "==> 检测磁盘使用率..."
DISK_USAGE=$(df / | awk 'NR==2 {gsub(/%/, "", $5); print $5}')
if [ "${DISK_USAGE:-0}" -gt 80 ]; then
  echo "ALERT: 磁盘使用率 ${DISK_USAGE}% 超过 80%"
  ALERT=1
fi

# 4. 数据库备份 > 26 小时未更新
echo "==> 检测备份时效..."
BACKUP_FILE="/tmp/last-backup-time"
if [ -f "$BACKUP_FILE" ]; then
  LAST_BACKUP=$(cat "$BACKUP_FILE")
  NOW=$(date +%s)
  DIFF=$(( (NOW - LAST_BACKUP) / 3600 ))
  if [ "$DIFF" -gt 26 ]; then
    echo "ALERT: 上次备份 ${DIFF} 小时前，超过 26 小时"
    ALERT=1
  fi
else
  echo "ALERT: 备份标记文件 ${BACKUP_FILE} 不存在，无法确认备份状态"
  ALERT=1
fi

if [ "$ALERT" -eq 0 ]; then
  echo "OK: 所有检测项正常"
fi

exit $ALERT
