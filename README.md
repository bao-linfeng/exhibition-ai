# Exhibition AI (展台 AI 设计平台)

面向展览展示行业的生成式 AI 展台设计与协同平台。通过 AI Agent 协作与自然语言交互，结合结构化展台需求（Brief）、展位空间限制与品牌资产，快速生成多方向创意概念效果图，支持多轮微调衍生、版本分支对比、内部审批流程与原图/打包导出。

---

## 目录

- [核心特性](#核心特性)
- [技术架构与技术栈](#技术架构与技术栈)
- [Monorepo 代码组织](#monorepo-代码组织)
- [架构分层与依赖边界](#架构分层与依赖边界)
- [快速上手 (本地开发)](#快速上手-本地开发)
  - [前置要求](#前置要求)
  - [首次初始化启动](#首次初始化启动)
  - [服务端口映射](#服务端口映射)
- [日常开发命令](#日常开发命令)
- [开发规范与 Issue 驱动流程](#开发规范与-issue-驱动流程)
- [项目规划与任务跟踪](#项目规划与任务跟踪)
- [文档索引](#文档索引)

---

## 核心特性

- **结构化需求 (Brief)**：支持展台尺寸（宽高深）、开面方向（1~4 面开）、展馆限高/安全规定、品牌色彩与关键词、功能分区（接待/展示/洽谈/储藏/LED/演示等）的结构化录入与版本快照（乐观锁 `revision`）。
- **资产与存储管理**：支持企业 Logo、参考效果图、CAD 展位图等素材上传；集成私有 RustFS (S3 兼容) 对象存储，通过短效预签名 URL 保证安全直传与下载。
- **AI 创意方向与批量生图**：首轮智能生成多套不同风格的设计方向与草图，支持批量生成 1~4 张候选方案。
- **自然语言修改与版本演进树**：针对选定效果图进行多轮自然语言调优，生成衍生版本；维护完整的父子版本树与主选方案指针，支持多分支对比与回退。
- **可靠异步任务体系**：基于 Fastify + BullMQ + PostgreSQL Outbox + Redis 异步队列，防重复提交，支持长耗时生图任务断线恢复与真实进度监控。
- **细粒度角色与权限 (RBAC)**：内置管理员 (`admin`)、设计师 (`designer`)、销售 (`sales`) 与观察员 (`viewer`) 四种角色，基于项目成员关系隔离访问。
- **方案评审与内部审批**：项目状态机生命周期流转（草稿 `draft` → 需求确认 `briefing` → 设计中 `designing` → 评审中 `reviewing` → 已批准 `approved`）。
- **原图与打包导出**：一键导出所选方案的高清原始大图及 ZIP 资产压缩包。
- **审计与费用管理**：操作审计与模型调用 Token/用量追踪，防超额调用。

---

## 技术架构与技术栈

| 模块 / 服务                        | 技术选型                      | 说明                                                                |
| ---------------------------------- | ----------------------------- | ------------------------------------------------------------------- |
| **前端应用 (`apps/web`)**          | Vue 3.5 + Vite 8 + TypeScript | 响应式 SPA，Element Plus / Tailwind CSS，openapi-fetch 类型安全调用 |
| **API 服务 (`apps/api`)**          | Fastify 5 + TypeBox + Pino    | 高性能 Node.js REST API，集成 Swagger / OpenAPI 契约                |
| **后台异步工作流 (`apps/worker`)** | BullMQ 6 + Redis 7.4          | 异步任务调度与图像生成处理                                          |
| **数据持久化**                     | PostgreSQL 17 + `pgvector`    | 关系型数据库，支持向量扩展（用于 P1 案例检索）                      |
| **缓存与消息队列**                 | Redis 7.4-alpine              | 任务队列引擎，启用 AOF 持久化                                       |
| **对象存储**                       | RustFS 1.0 (S3-compatible)    | 高性能 S3 兼容对象存储，附带 Web 管理控制台                         |
| **运行与容器化**                   | Docker Compose v2             | 全服务容器化编排，隔离宿主机环境，支持源码热更新                    |
| **包管理与规范**                   | pnpm 10.34.5 + Node.js 24 LTS | 严格版本锁定（`frozen-lockfile`）、ESLint 10、Prettier 3            |

---

## Monorepo 代码组织

```
exhibition-ai/
├── apps/
│   ├── api/            # Fastify 5 REST API 服务与路由定义
│   ├── web/            # Vue 3 + Vite 8 前端单页应用 (SPA)
│   └── worker/         # BullMQ 异步任务消费 Worker
├── packages/
│   ├── contracts/      # 契约层：TypeBox Schema、API 请求/响应协议（零内部依赖）
│   ├── backend/        # 服务端领域逻辑、DB/Redis/S3/BullMQ 基础设施容器
│   ├── db/             # PostgreSQL 连接池与 Drizzle ORM 数据库迁移配置
│   └── api-client/     # 基于 OpenAPI 自动生成的类型安全客户端
├── infra/
│   ├── compose.dev.yaml # 本地开发多服务 Docker Compose 编排
│   └── docker/         # 各环境 Dockerfile（开发镜像锁定 digest）
├── docs/               # 完整需求规范、本地开发手册、API 规范与架构图
├── scripts/            # 环境初始化、数据库迁移、契约生成、依赖边界检查等脚本
└── tasks.md            # 项目 41 项实施任务清单与完成度跟踪
```

---

## 架构分层与依赖边界

项目严格遵循单向依赖与分层隔离原则（由 `pnpm check:boundaries` 脚本在 CI 门禁中自动强制检验）：

```
[ apps/web ]  ───> [ packages/api-client ] ───> [ packages/contracts ]
                                                      ▲
[ apps/api ]    ───┐                                  │
                   ├──> [ packages/backend ] ─────────┘
[ apps/worker ] ───┘           │
                               ▼
                       [ packages/db ]
```

- **前端应用 (`apps/web`)**：仅可依赖 `packages/api-client` 与 `packages/contracts`，严禁引入 `packages/backend`、`packages/db` 或任何 `node:*` 服务端模块。
- **API 与 Worker**：作为入口装配层，依赖 `packages/backend` 与 `packages/contracts`；不跨应用互相引入源码。
- **契约包与数据库包**：`packages/contracts` 与 `packages/db` 保持独立，零内部跨包依赖。

---

## 快速上手 (本地开发)

### 前置要求

- **Git**
- **Docker Engine / Docker Desktop**（需使用 Linux Containers 模式）
- **Docker Compose v2**

> **注意**：本项目的所有开发、依赖安装、构建与服务均在 Docker 容器内执行。**宿主机无需安装 Node.js、pnpm 或 PostgreSQL**，切勿在宿主机直接执行 `pnpm install`。

---

### 首次初始化启动

#### 1. 生成环境配置与凭证文件

运行一次性设置脚本生成 `.env` 及本地工作目录（脚本将自动生成随机安全密钥）：

**Windows PowerShell:**

```powershell
docker run --rm --mount "type=bind,source=$($PWD.Path),target=/workspace" -w /workspace node:24.15.0-bookworm-slim@sha256:4e6b70dd6cbfc88c8157ba19aa3d9f9cce6ba4703576d55459e45efcbc9c5f5d node scripts/setup.mjs
```

**Linux / macOS:**

```sh
docker run --rm --user "$(id -u):$(id -g)" --mount "type=bind,source=$(pwd),target=/workspace" -w /workspace node:24.15.0-bookworm-slim@sha256:4e6b70dd6cbfc88c8157ba19aa3d9f9cce6ba4703576d55459e45efcbc9c5f5d node scripts/setup.mjs
```

#### 2. 构建开发工具镜像并安装锁定依赖

```sh
# 构建工具容器镜像
docker compose --env-file .env -f infra/compose.dev.yaml build devtools

# 容器内安装依赖（使用独立命名卷，不污染宿主机）
docker compose --env-file .env -f infra/compose.dev.yaml run --rm devtools pnpm install --frozen-lockfile

# 容器内预构建工作包基础产物
docker compose --env-file .env -f infra/compose.dev.yaml run --rm devtools pnpm build
```

#### 3. 启动基础存储与数据库服务

```sh
# 启动 PostgreSQL、Redis 和 RustFS
docker compose --env-file .env -f infra/compose.dev.yaml up -d postgres redis rustfs

# 执行数据库扩展初始化与迁移
docker compose --env-file .env -f infra/compose.dev.yaml run --rm migrate

# 初始化 S3 存储桶与跨域策略 (CORS)
docker compose --env-file .env -f infra/compose.dev.yaml run --rm storage-init
```

#### 4. 启动应用服务

```sh
# 启动 Web 前端、API 后端与异步 Worker
docker compose --env-file .env -f infra/compose.dev.yaml up -d web api worker

# 查看各容器运行状态
docker compose --env-file .env -f infra/compose.dev.yaml ps
```

---

### 服务端口映射

服务启动成功后，可通过本机回环地址直接访问各服务入口：

| 服务                   | 本机访问地址                                             | 容器内部网络地址 | 说明                                    |
| ---------------------- | -------------------------------------------------------- | ---------------- | --------------------------------------- |
| **Web 前端**           | [http://localhost:5173](http://localhost:5173)           | `web:5173`       | Vite 8 开发服务器（带 HMR）             |
| **REST API**           | [http://localhost:3000](http://localhost:3000)           | `api:3000`       | Fastify 5 服务入口                      |
| **API 文档 (Swagger)** | [http://localhost:3000/docs](http://localhost:3000/docs) | —                | 自动生成的 OpenAPI 交互文档             |
| **PostgreSQL 数据库**  | `localhost:55432`                                        | `postgres:5432`  | 默认库名与用户名均为 `exhibition`       |
| **Redis 缓存与队列**   | `localhost:56379`                                        | `redis:6379`     | 密码见本地 `.env` 中的 `REDIS_PASSWORD` |
| **RustFS S3 接口**     | [http://localhost:19000](http://localhost:19000)         | `rustfs:9000`    | S3 对象存储上传与访问终端               |
| **RustFS 控制台**      | [http://localhost:19001](http://localhost:19001)         | `rustfs:9001`    | 对象存储 Web 后台（账号密码见 `.env`）  |

---

## 日常开发命令

开发过程中所有命令均建议在 `devtools` 容器内运行。命令前缀：`docker compose --env-file .env -f infra/compose.dev.yaml`。

```sh
# 启动全部日常开发服务
docker compose --env-file .env -f infra/compose.dev.yaml up -d

# 查看实时应用日志
docker compose --env-file .env -f infra/compose.dev.yaml logs -f --tail 100 api worker web

# 运行全套门禁检查（Lint + 类型检查 + 架构边界 + OpenAPI 对齐 + 代码格式）
docker compose --env-file .env -f infra/compose.dev.yaml run --rm devtools pnpm check

# 运行集成测试 / 基础环境健康冒烟测试
docker compose --env-file .env -f infra/compose.dev.yaml run --rm devtools pnpm test:integration

# 修改 packages/contracts 中的 Schema 后重新生成 OpenAPI 规范与前端客户端
docker compose --env-file .env -f infra/compose.dev.yaml run --rm devtools pnpm api:generate

# 执行数据库迁移
docker compose --env-file .env -f infra/compose.dev.yaml run --rm migrate

# 停止服务（保留数据卷；切勿附加 -v，以免清空开发数据）
docker compose --env-file .env -f infra/compose.dev.yaml down
```

---

## 开发规范与 Issue 驱动流程

项目采用严格的 **Issue 驱动开发** 与 **代码审查门禁**：

1. **任务领取**：在 [tasks.md](tasks.md) 中确认任务依赖，仅领取前置已合入且无冲突的 Issue。
2. **分支创建**：以主干最新代码为基准检出新分支：
   - 功能开发：`feat/issue-<number>-<slug>`
   - 缺陷修复：`fix/issue-<number>-<slug>`
   - 工程配置：`chore/issue-<number>-<slug>`
3. **本地验证**：提交前必须在容器内通过 `pnpm check`（0 errors，包括代码格式与 OpenAPI 契约同步）。
4. **提交规范**：遵循 Conventional Commits，采用**简体中文**编写：
   - 示例：`feat: 实现项目 Brief 结构化字段校验`、`fix: 修复 S3 预签名直传跨域问题`
5. **PR 关联**：PR 标题须包含 `Closes #<number>`，并在描述中提供 Docker 环境验证记录。
6. **合入追踪**：PR 经审查合入后，在 `tasks.md` 勾选任务并回填 PR 链接。

---

## 项目规划与任务跟踪

需求细化为 41 个阶段性任务，完整规划与实时进度见 [tasks.md](tasks.md)：

- **阶段 M0（基础设施与工程基线）**：
  - [x] 技术栈锁定与 Monorepo 工程搭建 (`T001`, #1)
  - [x] Docker Compose 全服务开发环境搭建 (`T002`, #2)
  - [ ] API 契约协议与共享边界 (`T003`, #3)
  - [ ] 数据库迁移、环境配置与日志基础 (`T004`, #4)
  - [ ] 容器 CI 与 Issue/PR 交付门禁 (`T005`, #5)
- **阶段 M1（认证与客户项目底座）**：登录 Session、RBAC 权限、客户与项目 CRUD、实时 SSE 事件流 (`T006`～`T008`)
- **阶段 M2（Brief、素材与方向）**：结构化 Brief 校验、S3 素材直传、设计方向生成 (`T009`～`T013`)
- **阶段 M3（核心生成与任务流）**：生图 Worker、版本分支树、多轮对话修改 (`T014`～`T020`)
- **阶段 M4（方案对比、审批与 Agent 会话）**：版本对比挑选、项目审核状态机、Mastra Agent 协同 (`T021`～`T026`)
- **阶段 M5（导出、审计与总体验收）**：高清原图/ZIP 导出、用量与费用审计、端到端完整业务冒烟 (`T027`～`T031`)
- **后续阶段 (P1 / P2)**：历史案例库检索、PDF 提案输出、ComfyUI / 局部 Mask 重绘扩展 (`T032`～`T041`)

---

## 文档索引

- **[产品需求与工程规范](docs/REQUIREMENTS_AI_DEVELOPMENT.md)**：权威业务需求、权限矩阵、状态机、字段校验与验收基线。
- **[本地开发与排障指南](docs/DEVELOPMENT.md)**：详细的 Docker Compose 启动步骤、镜像 Digest 记录、常见问题排障。
- **[数据库 ER 关系设计](docs/database-er-diagram.md)**：完整数据库表结构与各业务领域模型关系。
- **[技术选型与依赖基线](docs/DEPENDENCY_BASELINE.md)**：各包依赖版本与官方源锁定记录。
- **[开发任务清单](tasks.md)**：41 项任务明细、完成状态与 GitHub Issue 映射。
- **[AI 代理与贡献者须知 (AGENTS.md)](AGENTS.md)**：AI Agent 协同开发指引与边界约定。
- **[Claude 协作规则 (CLAUDE.md)](CLAUDE.md)**：Claude Code 专属开发规范与命令速查。
