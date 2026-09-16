# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

展台 AI 设计平台，基于 Vue 3 + Fastify + PostgreSQL + Redis + RustFS 的 Monorepo 工程。用户通过自然语言与 AI Agent 协作生成展台设计效果图，支持多轮修改、版本管理、审批流程和资产导出。

**当前状态**：工程骨架与开发环境已搭建；核心业务功能（登录、需求管理、图片生成、Agent 会话）按 `tasks.md` 和 GitHub Issues 逐项实现中。

权威需求与架构约束见 `docs/REQUIREMENTS_AI_DEVELOPMENT.md`；本文仅覆盖日常开发必备的命令、目录归属和技术决策。

## 协作原则

### 沟通风格
- 面向用户的叙述默认使用简体中文；代码、命令、配置键、API 名称和技术标识保持英文
- 先给结论与影响，再给行动、待决策和必要证据；没有对应内容就省略
- 默认使用简洁、连贯的段落；只有并列、步骤或比较确实更清楚时才使用列表或表格
- 明确区分确定事实、合理判断和未知信息；只保留有助于理解结论、判断风险或复现结果的技术细节

### 执行方式
- 用户请求行动时，在已授权范围内自主推进到完整、可交付结果；用户明确只要求分析、解释、评审、建议或草稿时，不擅自实施修改
- 提问前先完成已经授权、并能把下一步变成具体可审查结果的工作。只有缺失信息会实质影响正确性、安全、兼容性或成本时才暂停询问
- 风险低、可逆且方向明确时，可基于合理假设继续；重要假设应明确说明
- 优先沿用项目已有工具链、依赖、约定和代码风格；采用最小必要改动，不做无关清理、机会主义重构、过度设计或猜测性抽象
- 不静默移除已有行为、兼容性或公开接口；任务明确要求改变时除外
- 不擅自修改 `AGENTS.md`、`CLAUDE.md`、Skills 或其他指令文件，除非任务明确要求
- 不把未经证实的假想风险升级为额外流程、警告、免责声明或范围扩张；只有与当前任务实际相关时才处理
- 长时间或多阶段任务中，在取得实质进展、发现重要问题或阶段转换时给出简短进度；不要为了汇报而汇报

### 真实性与验证
- 不编造 API、CLI 参数、版本、模型名、环境变量、路径、配置格式、平台行为、执行结果或验证结论
- 对可能变化且会影响结果的信息，优先通过实际环境、项目文件、源码或官方文档核实；无法核实时明确说明未知或尚未验证
- 验证强度与改动风险和影响范围相称。不为低风险、可逆、仅镜像实现细节的修改机械新增测试
- 运行与改动相称的检查；只有出现新改动、新失败或未解决疑点时才扩大或重复验证
- 不声称未实际完成或运行的结果。无法完成必要验证时，说明原因和由此产生的不确定性
- 同一输入和环境下出现相同失败时，不做没有信息增益的机械重试；先改变假设、实现、配置、环境或验证方法。只为明确的瞬态或 flaky 假设进行有限重试

### 授权与安全
- 对已授权、低风险、可逆、只读或工作区内的实现、修复和验证，不主动重复请求确认；仍服从当前环境的权限、审批和安全边界
- 当前请求未明确授权时，删除重要数据、不可逆迁移、重写 Git 历史或 force push、生产部署或写入、外部发布或发送、权限或凭证变更、DNS 或计费变更等高影响操作必须先确认
- 不在输出、代码、日志、文档或其他持久化内容中泄露或硬编码 API key、token、密码、私钥、cookie、连接字符串或其他凭证

## 开发环境

所有开发在 Docker Compose 环境中进行，宿主机无需 Node/pnpm/数据库。使用固定 Node `24.15.0`、pnpm `10.34.5`、TypeScript `5.9.3` strict 模式。

### 首次初始化

生成 `.env` 和 `.local/` 凭证（不能复制 `.env.example`，密钥为空会导致 Compose 失败）：

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

### 日常命令

所有命令从仓库根目录运行。基础设施命令前缀为 `docker compose --env-file .env -f infra/compose.dev.yaml`。

| 目标 | 命令 |
|------|------|
| 启动基础设施 | `… up -d postgres redis rustfs` |
| 执行数据库迁移 | `… run --rm migrate` |
| 初始化 S3 桶 | `… run --rm storage-init` |
| 启动应用 | `… up -d web api worker` |
| 查看日志 | `… logs --tail 100 api worker web` |
| 停止（保留数据） | `… down`（**绝不**使用 `down -v` 除非要销毁数据）|
| 完整 CI 检查 | `… run --rm devtools pnpm check` |
| 集成测试 | `… run --rm devtools pnpm test:integration` |

### 根 pnpm 脚本（在 devtools 容器内或本地安装后运行）

```sh
pnpm check          # lint + typecheck + boundaries + api:check + format:check — PR 前必须通过
pnpm lint           # ESLint (apps packages scripts)
pnpm typecheck      # pnpm -r typecheck
pnpm format         # prettier --write .
pnpm format:check   # prettier --check .
pnpm check:boundaries  # node scripts/check-boundaries.mjs
pnpm api:generate   # 导出 OpenAPI spec + 重新生成 packages/api-client/src/generated.ts
pnpm api:check      # 验证生成文件是最新的（CI 门禁）
pnpm build          # pnpm -r build
pnpm db:migrate     # scripts/db-migrate.mjs
pnpm storage:init   # scripts/storage-init.mjs
pnpm test:integration  # scripts/smoke.mjs（需要所有服务运行）
```

### 代码变更后重启服务

修改源文件后，必须重启相应服务以使运行的容器采用变更：

```sh
# API 变更
docker compose --env-file .env -f infra/compose.dev.yaml restart api

# Worker 变更
docker compose --env-file .env -f infra/compose.dev.yaml restart worker

# Web（Vite）变更 — Vite 自动热重载；仅在 HMR 卡住时重启
docker compose --env-file .env -f infra/compose.dev.yaml restart web

# 同时变更多个服务
docker compose --env-file .env -f infra/compose.dev.yaml restart api worker
```

**规则**：每次代码变更会话结束前，必须重启相关服务并检查日志（`logs --tail 50 <service>`）才能标记完成。

### 数据库与 API 契约

```sh
# 修改 Schema 后生成迁移
docker compose --env-file .env -f infra/compose.dev.yaml run --rm devtools pnpm db:generate

# 修改 packages/contracts 中的 Schema 后生成 OpenAPI 和客户端类型
docker compose --env-file .env -f infra/compose.dev.yaml run --rm devtools pnpm api:generate
```

## Monorepo 结构

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

### 架构边界（由 ESLint + `check:boundaries` 强制）

违反边界的导入会导致 `pnpm check` 失败。不要添加跨越这些界限的 import：

| Package | 可导入 |
|---|---|
| `web` | `api-client`, `contracts` 仅此。绝不 `node:*`, `backend`, `db`, `ai` |
| `api-client` | `contracts` 仅此 |
| `contracts` | 无内部依赖 |
| `db` | 无内部依赖 |
| `backend` | `db`, `contracts`。绝不 `ai` |
| `api` | `backend`, `contracts` |
| `worker` | `backend`, `ai`（当存在时）|

相对导入（`./`, `../`）不能逃出自己的 package 根目录。

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

### TypeScript 模块解析

- 所有包：`module: NodeNext` — 相对 import **必须使用 `.js` 扩展名**在编译输出中
- Package `exports` 包含 `"development": "./src/index.ts"` 条件 — Vite 和脚本直接消费源 TS 而无需预构建 `dist/`
- `apps/web`: `moduleResolution: Bundler`，Vite 条件 `['development', 'browser']`
- 脚本运行为：`node --import tsx --conditions=development scripts/*.mjs`

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

### 生成文件（已提交到 git）

这两个文件已提交且**必须与 API 代码保持同步**。任何路由/schema 变更后重新生成：

```sh
pnpm api:generate
```

- `docs/api/openapi.json`
- `packages/api-client/src/generated.ts`

`pnpm api:check` 在 CI 中检查它们是否过期。

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

### Git 与任务约定

- 分支命名：`feat/issue-<N>-<slug>`、`fix/issue-<N>-<slug>`、`chore/issue-<N>-<slug>`
- PR 标题必须包含 `Closes #<N>`
- Commit 消息：Conventional Commits 简体中文（`feat: 添加...`、`fix: 修复...`、`chore: ...`）
- 合并后更新 `tasks.md` 和 `docs/issues/manifest.json`
- 门禁：`pnpm check` 必须通过（0 错误）才能推送

### PR 前检查清单

```sh
pnpm check          # lint + typecheck + boundaries + api parity + format
pnpm api:check      # 如果任何路由或 schema 变更
```

## 环境变量与端口

`.env` 由 `scripts/setup.mjs` 生成。关键变量：

| Variable | Docker 网络内值 | 宿主机可访问 |
|---|---|---|
| `PGHOST` | `postgres` | `localhost:55432` |
| `REDIS_HOST` | `redis` | `localhost:56379` |
| `S3_ENDPOINT` | `http://rustfs:9000` | — |
| `S3_PUBLIC_ENDPOINT` | — | `http://localhost:19000` |
| `WEB_ORIGIN` | — | `http://localhost:5173` |
| `API_INTERNAL_URL` | `http://api:3000` | `http://localhost:3000` |

**S3 双端点**：后端内部代码必须使用 `S3_ENDPOINT`（Docker DNS）。浏览器的签名 URL 必须使用 `S3_PUBLIC_ENDPOINT`。

| 服务 | 本机地址 | 容器内地址 |
|------|----------|------------|
| Web | http://localhost:5173 | web:5173 |
| API | http://localhost:3000 | api:3000 |
| PostgreSQL | localhost:55432 | postgres:5432 |
| Redis | localhost:56379 | redis:6379 |
| RustFS S3 | http://localhost:19000 | rustfs:9000 |
| RustFS Console | http://localhost:19001 | rustfs:9001 |

所有端口仅绑定 `127.0.0.1`；RustFS 控制台凭证见本地 `.env`。

## 基础设施特性

### Docker Volume 隔离

每个工作区有独立的 Docker 命名卷用于 `node_modules`（如 `root_modules`、`web_modules`、`api_modules`）。这防止 Windows 宿主机的 `node_modules` 与 Linux 容器构建冲突。绝不在宿主机安装包 — 始终使用 devtools 容器。

### Vite 轮询

`apps/web/vite.config.ts` 设置 `usePolling: true, interval: 500` 以便 Windows 文件变更传播到 Linux 容器。

### Worker 存活检查

Worker 将 `Date.now()` 写入 `/tmp/exhibition-worker-health`。Compose 健康检查验证 mtime < 30 秒。

### 测试

尚无单元测试运行器（Vitest/Playwright 延后）。当前自动化测试是冒烟测试：

```sh
docker compose --env-file .env -f infra/compose.dev.yaml run --rm devtools pnpm test:integration
```

要求所有服务健康：带 `pgvector` 的 PostgreSQL、Redis、RustFS、API（`/api/health`、`/api/ready`）、Worker（BullMQ 探测队列）。

引入单元测试时：与源文件并置为 `*.test.ts`；跨应用测试放在根 `tests/`。

## 常见问题

**修改代码后 API/Worker 未重启**：检查 `docker compose logs api`，确认 `tsx watch` 正在监听；Windows 需确保 Docker Desktop 目录共享正常。注意：代码变更后必须手动重启服务（`docker compose restart api worker`）。

**数据库连接失败**：确认 `postgres` 服务健康（`docker compose ps`），`.env` 中 `DATABASE_URL` 正确。

**签名 URL 无法访问**：浏览器访问用 `S3_PUBLIC_ENDPOINT`；修改端口后重新运行 `storage-init` 应用 CORS。

**依赖安装失败**：检查容器联网与 npm registry 可达；使用 `--frozen-lockfile` 不会自动升级版本。

**类型错误**：确保运行过 `pnpm build`（共享包需先构建）和 `pnpm api:generate`（契约类型）。

**权限问题（Linux）**：首次 setup 使用 `--user "$(id -u):$(id -g)"`，确保 `.env` 和 `.local/` 属于当前用户。

## 参考文档

- **完整需求与架构**：`docs/REQUIREMENTS_AI_DEVELOPMENT.md`
- **开发环境详细说明**：`AGENTS.md`（技术实现细节）
- **任务清单与 Issue 映射**：`tasks.md`
- **依赖版本记录**（M0 生成）：`docs/DEPENDENCY_BASELINE.md`
- **部署与恢复**（M5 完成）：`docs/RUNBOOK.md`
