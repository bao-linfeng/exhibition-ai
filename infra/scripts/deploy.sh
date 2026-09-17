#!/usr/bin/env bash
# 必须从项目根目录运行：bash infra/scripts/deploy.sh
# 用法：IMAGE_TAG=v1.2.3 bash infra/scripts/deploy.sh
set -euo pipefail

COMPOSE="docker compose --env-file .env -f infra/compose.prod.yaml"
DEV_COMPOSE="docker compose --env-file .env -f infra/compose.dev.yaml"
IMAGE_TAG="${IMAGE_TAG:-latest}"

echo "==> [1/4] 拉取最新镜像 (tag: $IMAGE_TAG)"
$COMPOSE pull api worker web

echo "==> [2/4] 运行数据库迁移"
# 迁移通过 dev 镜像（含 pnpm）在生产数据库上执行；确保 postgres 已运行且 .env 已配置生产 DATABASE_URL
$DEV_COMPOSE run --rm migrate

echo "==> [3/4] 重启应用服务（保留 postgres/redis/rustfs 不停机）"
$COMPOSE up -d --no-deps api worker web

echo "==> [4/4] 检查服务健康状态"
sleep 10
$COMPOSE ps

echo "==> 部署完成"
