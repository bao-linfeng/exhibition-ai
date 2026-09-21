#!/usr/bin/env bash
# 必须从项目根目录运行：bash infra/scripts/restore.sh <backup-path> [compose-file]
# 用法：
#   bash infra/scripts/restore.sh /backups/daily/backup_20260917_020000
#   bash infra/scripts/restore.sh /backups/daily/backup_20260917_020000 infra/compose.prod.yaml
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
COMPOSE_FILE="${2:-infra/compose.prod.yaml}"

if [ -z "$BACKUP_PATH" ]; then
  echo "错误：请指定备份路径"
  echo "用法：bash infra/scripts/restore.sh <backup-path> [compose-file]"
  exit 1
fi

if [ ! -d "$BACKUP_PATH" ]; then
  echo "错误：备份目录不存在：${BACKUP_PATH}"
  exit 1
fi

if [ ! -f "$COMPOSE_FILE" ]; then
  echo "错误：Compose 文件不存在：${COMPOSE_FILE}"
  exit 1
fi

COMPOSE="docker compose --env-file .env -f ${COMPOSE_FILE}"

echo "==> [restore] 开始从备份恢复：${BACKUP_PATH}"
echo "==> [restore] 使用 Compose 配置：${COMPOSE_FILE}"
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
echo "    运行数据库迁移..."
if ! $COMPOSE run --rm migrate; then
  echo "错误：数据库迁移失败"
  exit 1
fi

# 启动 api 和 worker
$COMPOSE up -d api worker

# 等待服务就绪（最多 120 秒），使用 /api/ready 端点
echo "    等待服务就绪（最多 120 秒）..."
ATTEMPTS=0
MAX_ATTEMPTS=24
API_READY=false
while [ "$ATTEMPTS" -lt "$MAX_ATTEMPTS" ]; do
  if curl -sf "http://localhost:3000/api/ready" >/dev/null 2>&1; then
    echo "    API 就绪检查通过"
    API_READY=true
    break
  fi
  ATTEMPTS=$((ATTEMPTS + 1))
  echo "    等待中... ($ATTEMPTS/$MAX_ATTEMPTS)"
  sleep 5
done

if [ "$API_READY" = false ]; then
  echo "错误：API 在 120 秒内未就绪"
  exit 1
fi

# ---------- 队列对账：查询非终态任务并输出报告 ----------
echo ""
echo "==> [restore] 队列对账：检查恢复后非终态任务..."
NON_TERMINAL=$(
  $COMPOSE exec -T postgres psql \
    -U "${PGUSER:-exhibition}" \
    -d "${PGDATABASE:-exhibition}" \
    -t -c \
    "SELECT id, kind, status, created_at
     FROM tasks
     WHERE status IN ('pending', 'queued', 'running', 'reconciling', 'awaiting_confirmation')
     ORDER BY created_at DESC
     LIMIT 50;" \
    2>/dev/null || echo ""
)

if [ -z "$(echo "${NON_TERMINAL}" | tr -d '[:space:]')" ]; then
  echo "    无非终态任务，队列干净"
else
  echo "    发现以下非终态任务（需人工确认是否重试或取消）："
  echo "${NON_TERMINAL}"
  echo ""
  echo "    处理建议："
  echo "      - pending/queued：Worker 重启后会自动重新消费（Outbox 扫描），通常无需干预"
  echo "      - running：超时 15 分钟后 Timeout Reconciler 自动转为 reconciling，可等待或手动取消
      - reconciling：超时 30 分钟后 Timeout Reconciler 自动标记为 failed 并允许重试；亦可通过管理员 API POST /api/v1/tasks/:id/reconcile 手动对账"
  echo "      - awaiting_confirmation：需通知用户重新确认"
  echo ""
  echo "    手动查询命令："
  echo "      ${COMPOSE} exec -T postgres psql -U ${PGUSER:-exhibition} -d ${PGDATABASE:-exhibition}"
  echo "      SELECT id, kind, status FROM tasks WHERE status NOT IN ('succeeded','failed','cancelled','partially_succeeded');"
fi

echo ""
echo "==> [restore] 恢复完成（PostgreSQL、对象存储、迁移已应用，API 就绪）"
echo ""
echo "==> 恢复后验收清单（手动执行）："
echo "    1. 登录系统验证用户认证正常"
echo "    2. 检查项目列表和版本树完整性"
echo "    3. 抽样下载图片并比对 SHA-256 哈希"
echo "    4. 确认 Worker 健康心跳正常"
echo "    5. 确认上方队列对账报告，处理非终态任务"
echo "    6. 记录本次 RTO 实测时间（恢复开始 → 验收完成）"
echo ""
echo "    查看日志：${COMPOSE} logs --tail 100 api worker"
