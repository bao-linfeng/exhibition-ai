# 本地开发环境

当前交付工程启动骨架和真实 PostgreSQL、Redis、RustFS 开发依赖。业务模块依照需求逐项实现；能启动环境不代表登录、设计生成等业务已经完成。

本地搭建不等于 T001/T002 全部验收及 PR 合并完成，任务清单保持原状态。

## 前置条件

安装 Git、Docker Engine/Desktop（Linux containers）和 Docker Compose v2。宿主机无需安装 Node、pnpm 或数据库。Windows 先启动 Docker Desktop，Linux 确认当前用户可操作 Docker。以下命令均从仓库根目录运行。

基础镜像和 Node 镜像锁定 digest，pnpm 锁定 10.34.5，依赖使用根 pnpm-lock.yaml。首次下载需要访问 Docker Hub 和 https://registry.npmjs.org。

## 首次初始化

PowerShell：

```powershell
docker run --rm --mount "type=bind,source=$($PWD.Path),target=/workspace" -w /workspace node:24.15.0-bookworm-slim@sha256:4e6b70dd6cbfc88c8157ba19aa3d9f9cce6ba4703576d55459e45efcbc9c5f5d node scripts/setup.mjs
```

Linux/macOS shell：

```sh
docker run --rm --user "$(id -u):$(id -g)" --mount "type=bind,source=$(pwd),target=/workspace" -w /workspace node:24.15.0-bookworm-slim@sha256:4e6b70dd6cbfc88c8157ba19aa3d9f9cce6ba4703576d55459e45efcbc9c5f5d node scripts/setup.mjs
```

脚本创建随机凭证的 `.env` 和 `.local/logs`、`.local/tmp`，重复运行保留已有 `.env`。凭证不打印、不提交；`.env.example` 故意留空凭证。不要把 `.env.example` 直接复制后当成可用配置。

Linux 命令以宿主用户的 UID/GID 创建文件，确保当前用户能读取权限为 `0600` 的 `.env`。

两种系统接下来使用相同命令，逐条执行，失败时先解决再继续：

```sh
docker compose --env-file .env -f infra/compose.dev.yaml build devtools
docker compose --env-file .env -f infra/compose.dev.yaml run --rm devtools pnpm install --frozen-lockfile
docker compose --env-file .env -f infra/compose.dev.yaml run --rm devtools pnpm build
docker compose --env-file .env -f infra/compose.dev.yaml up -d postgres redis rustfs
docker compose --env-file .env -f infra/compose.dev.yaml run --rm migrate
docker compose --env-file .env -f infra/compose.dev.yaml run --rm storage-init
docker compose --env-file .env -f infra/compose.dev.yaml up -d web api worker
docker compose --env-file .env -f infra/compose.dev.yaml ps
```

`migrate` 和 `storage-init` 是显式一次性操作；初始化成功后再启动应用。环境使用私有 Bucket，浏览器对象链接用 `S3_PUBLIC_ENDPOINT`，容器访问用 `S3_ENDPOINT`，签名后不可替换 Host。所有端口仅绑定本机回环地址。

| 服务          | 本机入口               | 容器内入口    |
| ------------- | ---------------------- | ------------- |
| Web           | http://localhost:5173  | web:5173      |
| API           | http://localhost:3000  | api:3000      |
| PostgreSQL    | localhost:55432        | postgres:5432 |
| Redis         | localhost:56379        | redis:6379    |
| RustFS S3     | http://localhost:19000 | rustfs:9000   |
| RustFS 控制台 | http://localhost:19001 | rustfs:9001   |

RustFS 控制台凭证来自本地 `.env` 的 `S3_ACCESS_KEY`、`S3_SECRET_KEY`。如调整 Web 或 S3 宿主端口，同时更新 `.env` 中 `WEB_ORIGIN`、`S3_PUBLIC_ENDPOINT`，并重新执行 `storage-init` 应用 CORS。

## 日常开发与检查

```sh
docker compose --env-file .env -f infra/compose.dev.yaml up -d
docker compose --env-file .env -f infra/compose.dev.yaml run --rm devtools pnpm check
docker compose --env-file .env -f infra/compose.dev.yaml run --rm devtools pnpm build
docker compose --env-file .env -f infra/compose.dev.yaml run --rm devtools pnpm test:integration
docker compose --env-file .env -f infra/compose.dev.yaml logs --tail 100 api worker web
docker compose --env-file .env -f infra/compose.dev.yaml down
```

源码挂载到 `/workspace`。根目录和各工作包 `node_modules` 使用 Docker 命名卷，遮蔽宿主依赖；pnpm store 也单独持久化。新增实际工作包时同步添加依赖卷。Web 由 Vite 提供 HMR，并显式启用 polling；API/Worker 由 `tsx watch` 监听源码，其 Windows 文件变更传播需通过实际环境验证。修改依赖后重新运行容器内安装，再重启相关应用。

PostgreSQL、Redis AOF 和 RustFS 数据均在各自命名卷中。普通停止命令保留数据，不使用 `down -v`。更改 `.env` 密码不会自动修改已有 PostgreSQL 数据卷中的数据库密码；保留原配置或通过数据库管理命令完成密码变更。

## 排障

- Docker 连接失败：确认 Docker Desktop/Engine 已启动且使用 Linux containers。
- 缺少变量：从根目录运行初始化，并保留命令中的 `--env-file .env`；不要输出完整 `docker compose config`，其中可能含凭证，可用 `config --quiet` 检查语法。
- 安装下载失败：检查 Docker 容器联网与 npm 官方 registry 可达性；不要清空数据卷重试。
- 端口占用：修改 `.env` 的宿主端口配置，同步 Web Origin/S3 公开入口，然后重新创建应用。
- API/Worker 不健康：先用 `ps` 和指定服务 `logs --tail 100` 检查，确认迁移、Bucket 初始化和依赖安装成功。
- Windows 源码变更未生效：检查 Docker Desktop 目录共享，并确认 Vite/tsx 正在监听实际挂载源码；仅重启相关应用保留数据。

## 镜像核实记录

2026-09-14 实际 `docker pull` 并读取 RepoDigests：Node `24.15.0-bookworm-slim`、pgvector `pg17`、Redis `7.4-alpine`、RustFS `latest`。所有实际 digest 固化在 Dockerfile/Compose；RustFS 容器 `--version` 返回 `1.0.0-rc.6`，CLI 的配置键和启动命令由容器 `server --help` 核实。镜像可用性不等于应用、CORS 或跨系统热更新验收，最终以实际运行记录为准。

运行中的 PostgreSQL 执行 `postgres --version` 返回 `17.11 (Debian 17.11-1.pgdg12+2)`；Redis 执行 `redis-server --version` 返回 `7.4.11`。这两个实际版本对应上述锁定 digest。

## 本机验证记录（2026-09-14）

Windows PowerShell + Docker Desktop Linux containers 已验证：

- `pnpm install --frozen-lockfile` 成功；根与各包依赖位于命名卷，缓存配置为 `/pnpm/store`。
- 基础工程的 `pnpm build` 成功，Web、API、Worker 均产生 `dist` 构建产物。
- 新业务路由写入前的 `pnpm check` 成功，包含 ESLint、所有工作包类型检查、依赖边界、OpenAPI 产物一致性与格式检查。
- `migrate` 启用 `vector` 扩展；`storage-init` 创建私有 Bucket 并设置开发 Origin 的 CORS。
- `pnpm test:integration` 成功，验证 PostgreSQL/pgvector、Redis 键读写、S3 对象写读删除、Worker 队列往返及 API 健康/就绪响应。探测使用 UUID 数据，不调用付费模型。
- 浏览器访问 `http://localhost:5173`，页面显示全部依赖已连接；重新检查按钮正常，Vite 到 API 的代理可用。
- 修改 API/Worker 入口时间戳后，容器日志记录 tsx 自动重启并重新就绪；同机亦观察到共享 contracts 源码变动触发 API 重启。

当前为开发骨架，没有登录、AI 生成、管理员初始化或业务 seed。`db:migrate` 当前只初始化扩展，尚未实现完整业务迁移体系。Linux 宿主机、浏览器 HMR 内容更新、down/up 数据保留场景和生产部署未在本轮实测，不能据此宣称 T001/T002 全部验收完成。

最后复查期间，工作区新增了其他开发中的 `apps/api/src/modules/auth.ts` 与 `users.ts`。最新全仓构建因此失败：这些新路由使用了尚未配置的 `app.httpErrors`，`users.ts` 还缺少直接 TypeBox 依赖声明。上述历史构建/check 成功不能代表这些新增业务代码已通过；本轮未改写其业务实现。此时六个开发容器均为 healthy，独立的 `pnpm test:integration` 再次通过。

安装输出中的 `msgpackr-extract` 可选原生构建跳过提示不影响当前纯 JavaScript 队列路径，已由集成检查验证。不要为消除提示而批准所有第三方安装脚本。
