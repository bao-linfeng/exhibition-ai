#!/usr/bin/env bash
# 必须从项目根目录运行：bash infra/scripts/restore.sh <backup-path>
# 用法：
#   bash infra/scripts/restore.sh /backups/daily/backup_20260917_020000
#
# ⚠️  警告：此脚本会覆盖当前数据库和对象存储！
# ⚠️  恢复前请确认目标环境已停止 api 和 worker 服务，且已取得运维批准。
#
# 恢复流程（对应 T030 RTO ≤ 4 小时目标）：
#   1. 验证备份目录和 SHA-256 校验清单
#   2. 恢复 PostgreSQL
#   3. 恢复对象存储
#   4. 重启服务并运行健康检查
set -euo pipefail

BACKUP_PATH="${1:-}"
if [ -z "$BACKUP_PATH" ]; then
  echo "错误：请指定备份路径"
  echo "用法：bash infra/scripts/restore.sh <backup-path>"
  exit 1
fi

if [ ! -d "$BACKUP_PATH" ]; then
  echo "错误：备份目录不存在：${BACKUP_PATH}"
  exit 1
fi

COMPOSE="docker compose --env-file .env -f infra/compose.dev.yaml"

echo "==> [restore] 开始从备份恢复：${BACKUP_PATH}"
echo "==> [restore] 当前时间：$(date)"

# ---------- 1. 验证 SHA-256 校验清单 ----------
echo "==> [restore][1/4] 验证 SHA-256 校验清单..."
if [ ! -f "${BACKUP_PATH}/SHA256SUMS" ]; then
  echo "警告：未找到 SHA256SUMS 文件，跳过完整性校验"
else
  (
    cd "${BACKUP_PATH}"
    if sha256sum --check SHA256SUMS --quiet; then
      echo "    校验通过"
    else
      echo "错误：SHA-256 校验失败！备份可能已损坏。"
      exit 1
    fi
  )
fi

# ---------- 2. 恢复 PostgreSQL ----------
echo "==> [restore][2/4] 恢复 PostgreSQL..."
if [ ! -f "${BACKUP_PATH}/postgres.dump" ]; then
  echo "错误：未找到 postgres.dump 文件"
  exit 1
fi

# 停止 api 和 worker 避免写入冲突
echo "    停止 api 和 worker 服务..."
$COMPOSE stop api worker 2>/dev/null || true

# 删除并重建数据库
$COMPOSE exec -T postgres psql \
  -U "${PGUSER:-exhibition}" \
  -d postgres \
  -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${PGDATABASE:-exhibition}' AND pid <> pg_backend_pid();" \
  2>/dev/null || true

$COMPOSE exec -T postgres psql \
  -U "${PGUSER:-exhibition}" \
  -d postgres \
  -c "DROP DATABASE IF EXISTS \"${PGDATABASE:-exhibition}\";"

$COMPOSE exec -T postgres psql \
  -U "${PGUSER:-exhibition}" \
  -d postgres \
  -c "CREATE DATABASE \"${PGDATABASE:-exhibition}\" OWNER \"${PGUSER:-exhibition}\";"

$COMPOSE exec -T postgres psql \
  -U "${PGUSER:-exhibition}" \
  -d "${PGDATABASE:-exhibition}" \
  -c "CREATE EXTENSION IF NOT EXISTS vector;" \
  2>/dev/null || true

# 恢复 dump
$COMPOSE exec -T postgres pg_restore \
  -U "${PGUSER:-exhibition}" \
  -d "${PGDATABASE:-exhibition}" \
  --no-owner \
  --no-acl \
  < "${BACKUP_PATH}/postgres.dump"

echo "    PostgreSQL 恢复完成"

# ---------- 3. 恢复对象存储 ----------
echo "==> [restore][3/4] 恢复对象存储..."
if [ -d "${BACKUP_PATH}/objects" ]; then
  if command -v mc &>/dev/null; then
    mc alias set restore-dst \
      "${S3_ENDPOINT:-http://localhost:19000}" \
      "${S3_ACCESS_KEY:-}" \
      "${S3_SECRET_KEY:-}" \
      --api s3v4 \
      --quiet 2>/dev/null || true

    # 确保 bucket 存在
    mc mb "restore-dst/${S3_BUCKET:-exhibition}" --ignore-existing --quiet 2>/dev/null || true

    mc mirror "${BACKUP_PATH}/objects/" \
      "restore-dst/${S3_BUCKET:-exhibition}" \
      --overwrite --quiet
  elif command -v aws &>/dev/null; then
    AWS_ACCESS_KEY_ID="${S3_ACCESS_KEY:-}" \
    AWS_SECRET_ACCESS_KEY="${S3_SECRET_KEY:-}" \
    aws s3 sync \
      "${BACKUP_PATH}/objects/" \
      "s3://${S3_BUCKET:-exhibition}" \
      --endpoint-url "${S3_ENDPOINT:-http://localhost:19000}" \
      --no-progress
  else
    echo "WARN: 未找到 mc 或 aws 工具，跳过对象存储恢复"
    echo "      请手动将 ${BACKUP_PATH}/objects/ 上传到 S3"
  fi
  echo "    对象存储恢复完成"
else
  echo "WARN: 未找到对象存储备份目录 ${BACKUP_PATH}/objects，跳过对象存储恢复"
fi

# ---------- 4. 重启服务并运行健康检查 ----------
echo "==> [restore][4/4] 重启服务并检查健康状态..."

# 运行数据库迁移（确保迁移版本与代码一致）
$COMPOSE run --rm migrate 2>/dev/null || true

# 启动 api 和 worker
$COMPOSE up -d api worker

# 等待服务就绪（最多 120 秒）
echo "    等待服务就绪（最多 120 秒）..."
ATTEMPTS=0
MAX_ATTEMPTS=24
while [ "$ATTEMPTS" -lt "$MAX_ATTEMPTS" ]; do
  HEALTH=$(curl -sf "http://localhost:3000/api/health" 2>/dev/null || echo "")
  if [ -n "$HEALTH" ]; then
    echo "    API 健康检查通过：${HEALTH}"
    break
  fi
  ATTEMPTS=$((ATTEMPTS + 1))
  echo "    等待中... ($ATTEMPTS/$MAX_ATTEMPTS)"
  sleep 5
done

if [ "$ATTEMPTS" -eq "$MAX_ATTEMPTS" ]; then
  echo "警告：API 在 120 秒内未响应，请手动检查服务状态"
fi

echo ""
echo "==> [restore] 恢复完成"
echo ""
echo "==> 恢复后验收清单（手动执行）："
echo "    1. 登录系统验证用户认证正常"
echo "    2. 检查项目列表和版本树完整性"
echo "    3. 抽样下载图片并比对 SHA-256 哈希"
echo "    4. 确认 Worker 健康心跳正常"
echo "    5. 记录本次 RTO 实测时间"
echo ""
echo "    查看日志：${COMPOSE} logs --tail 100 api worker"
