#!/usr/bin/env bash
# 必须从项目根目录运行：bash infra/scripts/deploy.sh
# 用法：IMAGE_TAG=v1.2.3 bash infra/scripts/deploy.sh
set -euo pipefail

COMPOSE="docker compose --env-file .env -f infra/compose.prod.yaml"
IMAGE_TAG="${IMAGE_TAG:-latest}"

echo "==> [1/6] 拉取最新镜像 (tag: $IMAGE_TAG)"
$COMPOSE pull api worker web

echo "==> [2/6] 确保基础设施运行"
$COMPOSE up -d postgres redis rustfs

echo "==> [3/6] 运行数据库迁移"
$COMPOSE run --rm migrate

echo "==> [4/6] 初始化对象存储"
$COMPOSE run --rm storage-init

echo "==> [5/6] 初始化管理员（幂等，已存在时跳过）"
# 需要 .env 中配置 ADMIN_EMAIL 和 ADMIN_PASSWORD（至少12位），或通过 Shell 环境传入
if [ -z "${ADMIN_EMAIL:-}" ] || [ -z "${ADMIN_PASSWORD:-}" ]; then
  echo "  ⚠ ADMIN_EMAIL / ADMIN_PASSWORD 未设置，跳过管理员初始化"
  echo "    首次部署请手动运行：ADMIN_EMAIL=<email> ADMIN_PASSWORD=<secret> \\"
  echo "      $COMPOSE run --rm \\"
  echo "        -e ADMIN_EMAIL=<email> \\"
  echo "        -e ADMIN_PASSWORD=<secret> \\"
  echo "        devtools pnpm user:bootstrap"
else
  $COMPOSE run --rm \
    -e ADMIN_EMAIL="${ADMIN_EMAIL}" \
    -e ADMIN_PASSWORD="${ADMIN_PASSWORD}" \
    -e ADMIN_DISPLAY_NAME="${ADMIN_DISPLAY_NAME:-Administrator}" \
    devtools pnpm user:bootstrap
fi

echo "==> [5.5/6] 初始化模型配置（幂等，已存在时跳过）"
if [ "${AI_PROVIDER_MODE:-}" = "mock" ]; then
  echo "  ⚠ AI_PROVIDER_MODE=mock 不允许在生产环境使用，跳过模型初始化"
  echo "    请在 .env 中配置真实的 AI_PROVIDER_MODE"
  exit 1
fi
$COMPOSE run --rm \
  -e AI_PROVIDER_MODE="${AI_PROVIDER_MODE:-mock}" \
  devtools pnpm model:bootstrap

echo "==> [6/6] 重启应用服务"
$COMPOSE up -d --no-deps api worker web

echo "==> 等待服务就绪"
sleep 10
$COMPOSE ps

echo "==> 部署完成"
