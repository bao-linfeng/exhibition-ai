# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

展台 AI 设计平台，基于 Vue 3 + Fastify + PostgreSQL + Redis + RustFS 的 Monorepo 工程。用户通过自然语言与 AI Agent 协作生成展台设计效果图，支持多轮修改、版本管理、审批流程和资产导出。

**当前状态**：工程骨架与开发环境已搭建；核心业务功能（登录、需求管理、图片生成、Agent 会话）按 `tasks.md` 和 GitHub Issues 逐项实现中。

权威需求与架构约束见 `docs/REQUIREMENTS_AI_DEVELOPMENT.md`；本文仅覆盖日常开发必备的命令、目录归属和技术决策。

## 开发命令

所有开发在 Docker Compose 环境中进行，宿主机无需 Node/pnpm/数据库。

### 环境启动

首次初始化（生成 `.env` 和本地目录）：

```sh
# Windows PowerShell
docker run --rm --mount "type=bind,source=$($PWD.Path),target=/workspace" -w /workspace node:24.15.0-bookworm-slim@sha256:4e6b70dd6cbfc88c8157ba19aa3d9f9cce6ba4703576d55459e45efcbc9c5f5d node scripts/setup.mjs

# Linux/macOS
docker run --rm --user "$(id -u):$(id -g)" --mount "type=bind,source=$(pwd),target=/workspace" -w /workspace node:24.15.0-bookworm-slim@sha256:4e6b70dd6cbfc88c8157ba19aa3d9f9cce6ba4703576d55459e45efcbc9c5f5d node scripts/setup.mjs
```

安装依赖并启动环境：

```sh
docker compose --env-file .env -f infra/compose.dev.yaml build devtools
docker compose --env-file .env -f infra/compose.dev.yaml run --rm devtools pnpm install --frozen-lockfile
docker compose --env-file .env -f infra/compose.dev.yaml run --rm devtools pnpm build
docker compose --env-file .env -f infra/compose.dev.yaml up -d postgres redis rustfs
docker compose --env-file .env -f infra/compose.dev.yaml run --rm migrate
docker compose --env-file .env -f infra/compose.dev.yaml run --rm storage-init
docker compose --env-file .env -f infra/compose.dev.yaml up -d web api worker
```

日常启停：

```sh
docker compose --env-file .env -f infra/compose.dev.yaml up -d
docker compose --env-file .env -f infra/compose.dev.yaml logs --tail 100 api worker web
docker compose --env-file .env -f infra/compose.dev.yaml down  # 不带 -v，保留数据卷
```

### 检查与构建

```sh
# 完整检查（lint + typecheck + 边界 + API 契约 + 格式）
docker compose --env-file .env -f infra/compose.dev.yaml run --rm devtools pnpm check

# 单项检查
docker compose --env-file .env -f infra/compose.dev.yaml run --rm devtools pnpm lint
docker compose --env-file .env -f infra/compose.dev.yaml run --rm devtools pnpm typecheck
docker compose --env-file .env -f infra/compose.dev.yaml run --rm devtools pnpm check:boundaries
docker compose --env-file .env -f infra/compose.dev.yaml run --rm devtools pnpm api:check

# 构建所有包
docker compose --env-file .env -f infra/compose.dev.yaml run --rm devtools pnpm build
```

### 数据库与存储

```sh
# 生成迁移（修改 Schema 后）
docker compose --env-file .env -f infra/compose.dev.yaml run --rm devtools pnpm db:generate

# 执行迁移
docker compose --env-file .env -f infra/compose.dev.yaml run --rm migrate

# 重新初始化存储 CORS（修改端口后）
docker compose --env-file .env -f infra/compose.dev.yaml run --rm storage-init
```

### API 契约

修改 `packages/contracts` 中的 Schema 后：

```sh
# 生成 OpenAPI 和客户端类型
docker compose --env-file .env -f infra/compose.dev.yaml run --rm devtools pnpm api:generate

# 验证契约产物与提交版本一致
docker compose --env-file .env -f infra/compose.dev.yaml run --rm devtools pnpm api:check
```

### 测试

```sh
# 单元测试（实际实现后可用）
docker compose --env-file .env -f infra/compose.dev.yaml run --rm devtools pnpm test

# 集成测试
docker compose --env-file .env -f infra/compose.dev.yaml run --rm devtools pnpm test:integration
```

## 目录结构与归属规则

严格按照 `docs/REQUIREMENTS_AI_DEVELOPMENT.md` 第 6 节执行；以下是核心约束。

### Monorepo 结构

```
exhibition-ai/
├── apps/
│   ├── web/          # Vue 3 SPA（Vite + TanStack Query + Pinia）
│   ├── api/          # Fastify HTTP/SSE 入口
│   └── worker/       # BullMQ 消费者 + Mastra Agent 运行时
├── packages/
│   ├── contracts/    # TypeBox Schema（HTTP + Event），浏览器安全
│   ├── api-client/   # OpenAPI 生成类型 + openapi-fetch
│   ├── backend/      # 仅服务端：Service/Repository/Policy
│   ├── db/           # Drizzle Schema + 迁移 + 连接池
│   └── ai/           # 模型适配、Mastra、Tools、Prompt（按需实现）
├── infra/            # Compose、Dockerfile、Nginx 配置
├── scripts/          # 开发脚本（setup、migrate、契约生成）
├── docs/             # 需求、架构决策、运维手册
└── tests/            # E2E 和跨应用集成测试
```

**包说明**：
- `contracts`：HTTP 请求/响应 Schema 和 SSE 事件定义，可在浏览器安全使用
- `api-client`：由 OpenAPI 生成的类型化客户端，Web 应用通过此包调用 API
- `backend`：业务逻辑层，包含 Service、Repository、Policy，仅服务端使用
- `db`：数据库 Schema、迁移文件和连接管理
- `ai`：AI 模型适配器和 Mastra 集成（按业务需求逐步实现）

### Web 应用目录（apps/web/src）

```
src/
├── main.ts、App.vue           # 入口与根组件
├── router/                    # 路由表与守卫
├── views/                     # 路由页面组件
│   ├── auth/                  # LoginView.vue、AccountView.vue
│   ├── dashboard/             # DashboardView.vue
│   ├── projects/              # ProjectListView.vue、ProjectDetailView.vue
│   ├── design/                # DesignWorkspaceView.vue（设计工作台）
│   └── ...                    # 其他页面视图
├── components/                # 组件目录
│   ├── layouts/               # AppLayout.vue、ProjectLayout.vue
│   ├── common/                # PageHeader、EmptyState、LoadingSpinner 等通用组件
│   ├── auth/                  # LoginForm、PasswordForm 等认证相关组件
│   ├── projects/              # ProjectCard、ProjectForm、MemberList 等
│   ├── briefs/                # BriefEditor、BriefHistory 等
│   ├── assets/                # AssetUploader、AssetGrid 等
│   ├── design/                # 设计工作台子组件
│   │   ├── DesignCanvas.vue
│   │   ├── GenerationPanel.vue
│   │   └── VersionCompare.vue
│   ├── generations/           # GenerationForm、TaskCard 等
│   ├── versions/              # VersionGrid、VersionTree 等
│   ├── conversations/         # AgentPanel、MessageItem 等
│   └── ui/                    # shadcn-vue 基础组件（Button、Card、Dialog 等）
├── composables/               # 组合式函数
│   ├── useAuth.ts
│   ├── useProject.ts
│   ├── useMediaQuery.ts
│   └── ...
├── api/                       # API 客户端配置
│   ├── client.ts              # 配置 api-client、拦截器
│   └── queries/               # TanStack Query 定义
│       ├── auth.ts
│       ├── projects.ts
│       ├── assets.ts
│       └── ...
├── stores/                    # Pinia 状态管理
│   ├── user.ts                # 用户摘要、角色
│   ├── ui.ts                  # 主题、面板配置
│   └── ...
├── utils/                     # 工具函数
│   ├── format.ts              # 日期、数值格式化
│   ├── validation.ts          # 表单校验
│   └── cn.ts                  # Tailwind class 合并
├── types/                     # 类型定义
│   ├── models.ts              # 业务模型类型
│   └── ...
├── assets/                    # 静态资源
│   ├── icons/
│   └── images/
└── styles/                    # 样式文件
    ├── main.css               # Tailwind 入口
    └── tokens.css             # 设计 token
```

**目录归属原则**：
- **views/**：路由页面组件，对应 Vue Router 路由表
- **components/**：按功能模块组织业务组件；`common/` 存放跨模块通用组件；`ui/` 存放 shadcn-vue 基础组件
- **composables/**：可复用的组合式函数，优先使用 `use` 前缀
- **api/queries/**：TanStack Query 的 queryKey、queryOptions 和 mutations
- **stores/**：仅存用户摘要、主题、UI 状态等轻量级全局状态
- 组件间依赖：同模块内自由引用；跨模块复用提升到 `components/common/`
- 禁止深层路径 import（如 `@/components/projects/internal/...`），通过 `index.ts` 显式导出

### 服务端目录

**API（apps/api/src）**：
```
src/
├── server.ts、app.ts          # 启动入口与 Fastify 实例
├── bootstrap.ts               # 装配依赖（DB/Storage/Service）
├── plugins/                   # auth、security、openapi、error-handler
├── modules/                   # 按业务模块注册路由（projects/、assets/...）
└── realtime/                  # SSE 订阅与事件推送
```

**Worker（apps/worker/src）**：
```
src/
├── main.ts、bootstrap.ts
├── processors/                # image-generation、asset-validation、agent-run、export
└── schedulers/                # outbox-dispatcher、task-reconciler
```

**Backend（packages/backend/src）**：
```
src/
├── modules/                   # 业务模块
│   ├── auth/                  # 认证、Session 管理
│   ├── users/                 # 用户管理
│   ├── projects/
│   │   ├── project.service.ts     # 用例、权限、事务边界
│   │   ├── project.repository.ts  # Drizzle 查询
│   │   └── project.policy.ts      # 授权判断
│   ├── customers/             # 客户管理
│   ├── briefs/                # 需求管理
│   ├── assets/                # 资产上传与校验
│   ├── generations/           # 图片生成任务
│   ├── image-versions/        # 版本管理
│   ├── conversations/         # Agent 会话
│   ├── tasks/                 # 任务调度
│   ├── exports/               # 导出任务
│   └── audit/                 # 审计日志
├── ports/                     # 外部能力接口
│   ├── ImageProvider.ts       # 图片生成适配器接口
│   ├── StorageProvider.ts     # 对象存储接口
│   └── QueueProvider.ts       # 队列接口
├── infrastructure/            # 基础设施实现
│   ├── storage/               # S3 实现、签名 URL、流式读写
│   ├── queue/                 # 队列名、payload、producer
│   ├── config/                # 服务端环境校验
│   └── logging/               # Pino 与脱敏
└── shared/                    # 共享工具
    ├── ActorContext.ts        # 操作者上下文
    ├── errors.ts              # 业务错误定义
    └── transaction.ts         # 事务辅助函数
```

### 依赖方向（强制）

```
web → api-client → generated types
web → contracts（仅事件校验，不应大量依赖）
api → backend → db
worker → backend → db
worker → ai → backend ports（注入，不直接依赖）
contracts：独立，不依赖任何业务包
```

**严禁**：
- Web 导入服务端包（backend/db/ai）
- 跨 apps 的 src 引用
- backend 导入 ai（由 Worker 注入 Provider）
- 绕过 package.json `exports` 的深层私有 import

使用 `pnpm check:boundaries` 强制检查。

## 技术栈与约定

### 核心依赖

- **Runtime**: Node.js 24 LTS、pnpm 10.34.5、TypeScript 5.9（strict）、ESM
- **Web**: Vue 3.5、Vite 8、Vue Router 5、Pinia 3、TanStack Vue Query v5、shadcn-vue、Tailwind CSS 4
- **API**: Fastify 5、TypeBox、@fastify/swagger
- **数据库**: PostgreSQL 17、Drizzle ORM、node-postgres
- **异步**: Redis 7.4、BullMQ
- **存储**: RustFS（S3 兼容）、AWS SDK v3、sharp
- **Agent**: Mastra（嵌入 Worker）
- **测试**: Vitest、Vue Test Utils、Fastify inject、Playwright

所有版本锁定在 `pnpm-lock.yaml`；升级需通过 `docs/DEPENDENCY_BASELINE.md` 记录并验证。

### 命名与风格

- 数据库：`snake_case`；HTTP/TS：`camelCase`；组件文件：`PascalCase`
- Composable 函数：`useXxx`
- Vue 组件：`<script setup lang="ts">`
- 服务端：`module/moduleResolution: NodeNext`，编译为 ESM；相对 import 使用 `.js` 扩展名
- Web：`moduleResolution: Bundler`
- 默认不写注释，除非 WHY 非显而易见（隐藏约束、workaround、反直觉行为）

### 代码约束

- 所有路由有 Schema 校验（params/query/body/response）
- 使用 TypeBox 定义 Schema，由 Fastify 导出 OpenAPI
- 权限在 Service 层校验，HTTP 层不能替代
- 金额使用 bigint 最小单位 + 币种，禁止浮点运算
- UUID 作为业务 ID；时间用 `timestamptz` 存储，API 返回 UTC ISO 8601
- 乐观锁使用整数 `revision`，冲突返回 409
- 异步任务创建返回 202 + taskId，不阻塞 HTTP

## 核心业务规则

### 权限模型

- 角色：`admin`、`designer`、`sales`、`viewer`（存用户表）
- 项目关系：`project_members`（user + project 多对多）
- 有效权限 = 用户角色 ∩ 项目成员范围；admin 访问全部项目
- 负责人：仅增加成员管理和归档权限，不提升角色本身的生成/批准能力
- 所有子资源（任务、资产、版本、导出、SSE）沿项目验证权限

### 项目状态机

```
draft → briefing → designing → reviewing → approved
                      ↑           │
                      └───────────┘ 退回
任一非归档 → archived → 恢复到归档前状态
```

- `reviewing`/`approved` 禁止修改 Brief、选中版本、新生成；必须先退回/重新打开
- 归档前无活跃任务和待确认 Agent 操作

### Brief 与版本

- Brief 每次修改产生新 `revision`（不可变快照）
- 生成任务必须使用已确认的 Brief revision
- 修改旧图时若 Brief 已变，必须让用户确认"以当前 Brief 继续"
- 图片版本用 `parentVersionId` 形成树；项目单一 `selectedVersionId` 指针
- 版本 `sequence` 单调递增，仅用于 UI 展示（V1、V2...）

### 任务与费用

- Task 状态：`pending → queued → running → succeeded/failed/cancelled/partially_succeeded`
- 输出单元（task_outputs）：每张图一个 ordinal，独立 attempt 和状态
- 费用流程：创建 Task 时预留 → 执行前验证额度 → 完成后结算/释放
- 未知费用（unknown）：不自动重试，管理员对账后标记为 succeeded/failed
- 取消：尽力而为；已调用 Provider 的费用仍可能产生

### 异步架构

- PG Task 表为业务唯一真源
- PG 事务写 Task + inputs + outputs + 费用预留 + Outbox 事件
- Outbox dispatcher 扫描并投递 BullMQ
- Worker 从 PG 读取快照，条件更新领取执行权（fencing token）
- 结果事务写资产 + 版本 + output + 费用结算 + 项目事件
- 故障恢复：Redis 宕机不丢任务；Worker 崩溃由租约超时触发恢复；Provider 未知结果进入 reconciling

### SSE 与实时

- 每个项目一条 SSE 连接（`/api/v1/projects/:id/events`）
- 事件类型：`task.updated`、`message.delta`、`message.completed`、`confirmation.created`、`asset.ready`、`version.created`、`project.updated`
- 项目内事件有单调 `sequence`；重连用 `Last-Event-ID` 或 `after` cursor
- 过旧 cursor 返回 `stream.reset`，客户端重新 GET 快照
- 服务端每 30 秒复核 Session 和项目权限

## 开发工作流

### 功能开发流程

1. 从 `tasks.md` 选择前置已合并的 Issue
2. 基于最新 main 建分支：`feat/issue-<number>-<slug>` 或 `fix/issue-<number>-<slug>`
3. 按垂直闭环实现：Schema → 迁移 → Service → API/Worker → 生成 Client → Web
4. 运行 `pnpm check` 和相关测试
5. 提交 PR，正文使用 `Closes #<number>`
6. 合并后回填 tasks.md 的真实 Issue/PR 链接并勾选

### 数据库变更

1. 修改 `packages/db/src/schema/` 中的 Drizzle Schema
2. 运行 `pnpm db:generate` 生成迁移 SQL
3. **人工审阅** 生成的 SQL（`packages/db/migrations/`）
4. 运行 `pnpm db:migrate` 应用到本地
5. 迁移与业务代码同一 PR 提交

### API 契约变更

1. 修改 `packages/contracts/src/` 中的 TypeBox Schema
2. 运行 `pnpm api:generate` 更新 `docs/api/openapi.json` 和 `packages/api-client/src/generated/schema.d.ts`
3. 提交生成的产物（契约即代码）
4. CI 运行 `pnpm api:check` 验证产物与提交一致

### 禁止操作

- 不修改 `CLAUDE.md`、`AGENTS.md`、`docs/REQUIREMENTS_AI_DEVELOPMENT.md` 或 Skill 文件，除非 Issue 明确要求
- 不擅自升级依赖版本、更改目录结构、引入新框架
- 不把未验证的 Mock 结果描述为真实可用
- 不绕过权限、不跳过费用预留、不静默忽略用户取消
- 不在 Web 保存访问凭证到 localStorage
- 不记录完整 Cookie、Authorization、签名 URL、上传原文或 Prompt 到日志

## 本地服务端口

| 服务 | 本机地址 | 容器内地址 |
|------|----------|------------|
| Web | http://localhost:5173 | web:5173 |
| API | http://localhost:3000 | api:3000 |
| PostgreSQL | localhost:55432 | postgres:5432 |
| Redis | localhost:56379 | redis:6379 |
| RustFS S3 | http://localhost:19000 | rustfs:9000 |
| RustFS Console | http://localhost:19001 | rustfs:9001 |

所有端口仅绑定 `127.0.0.1`；RustFS 控制台凭证见本地 `.env`。

## 常见问题

**修改代码后 API/Worker 未重启**：检查 `docker compose logs api`，确认 `tsx watch` 正在监听；Windows 需确保 Docker Desktop 目录共享正常。

**数据库连接失败**：确认 `postgres` 服务健康（`docker compose ps`），`.env` 中 `DATABASE_URL` 正确。

**签名 URL 无法访问**：浏览器访问用 `S3_PUBLIC_ENDPOINT`；修改端口后重新运行 `storage-init` 应用 CORS。

**依赖安装失败**：检查容器联网与 npm registry 可达；使用 `--frozen-lockfile` 不会自动升级版本。

**类型错误**：确保运行过 `pnpm build`（共享包需先构建）和 `pnpm api:generate`（契约类型）。

**权限问题（Linux）**：首次 setup 使用 `--user "$(id -u):$(id -g)"`，确保 `.env` 和 `.local/` 属于当前用户。

## 参考文档

- **完整需求与架构**：`docs/REQUIREMENTS_AI_DEVELOPMENT.md`
- **开发环境详细说明**：`docs/DEVELOPMENT.md`
- **任务清单与 Issue 映射**：`tasks.md`
- **依赖版本记录**（M0 生成）：`docs/DEPENDENCY_BASELINE.md`
- **部署与恢复**（M5 完成）：`docs/RUNBOOK.md`
