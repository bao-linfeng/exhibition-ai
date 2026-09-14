# 展览公司 AI 展台设计 Agent — 技术选型与存储设计

## 1. 项目定位

本项目面向展览/展会公司，核心目标是构建一个以 **AI 展台设计与图片生成** 为主的 Agent 系统。

主要能力包括：

- 展台项目创建与管理
- 客户需求结构化
- 品牌资料、Logo、产品图、参考图上传
- AI 自动生成多个展台设计方向
- AI 效果图生成
- 多轮对话修改
- 图片版本管理
- 历史项目与案例检索
- 后续扩展报价、BOM、施工图、ComfyUI 等能力

---

## 2. 技术选型

### Web

第一阶段建议把前端明确为一个 **Vue 3 SPA 管理端 + AI 设计工作台**，不引入 Nuxt/SSR，避免把 AI 工作台、长任务状态、图片编辑与服务端渲染混在一起。

#### Web 核心技术栈

| 层 | 推荐 | 主要职责 |
|---|---|---|
| Framework | Vue 3.5.41 + TypeScript | 当前最新稳定版 Vue，页面、组件、组合式逻辑 |
| Build | Vite 8.x | 开发服务器、构建、环境变量 |
| Router | Vue Router 5.x | 页面路由、项目子路由、权限守卫 |
| Client State | Pinia 3.x | 登录态、UI 状态、设计工作台临时状态 |
| Server State | TanStack Vue Query v5 | API 数据缓存、刷新、Mutation、任务状态 |
| Base UI | shadcn-vue | Button、Dialog、Drawer、Dropdown、Form、Table、Tabs 等基础 UI；源码直接进入项目，便于高度定制 |
| AI UI | AI Elements Vue 1.5.x | Conversation、Message、Prompt Input、Reasoning、Tool、Sources、Model Selector、Image 等 AI 原生组件 |
| Styling | Tailwind CSS 4.x | 工作台布局、主题变量、细粒度样式、响应式 |
| API Client | OpenAPI 生成 Client + fetch | 和 Fastify OpenAPI 保持类型一致 |
| Realtime | SSE | 图片生成进度、Agent 流式输出、任务状态 |
| Image | 原生 Canvas / CSS + 后续 Konva/Fabric | 图片标记、框选、局部修改第二阶段再引入 |
| Test | Vitest + Vue Test Utils | Composable、Store、关键组件测试 |
| E2E | Playwright | 项目创建→上传→生成→选图完整链路 |

#### 前端版本基线（2026-09 建议）

```text
Node.js          22.21.1
Vue              3.5.41
TypeScript       5.x
Vite             8.x
Vue Router       5.x
Pinia            3.x
TanStack Query   v5
shadcn-vue       latest
AI Elements Vue  1.5.x
Tailwind CSS     4.x
```

不建议在项目初期追逐 nightly / rc 版本；生产依赖锁定具体 patch 版本。


#### AI UI 组件体系

本项目不再使用 Element Plus 作为主 UI。

推荐采用：

```text
shadcn-vue
+
AI Elements Vue
+
Tailwind CSS
```

职责分工：

```text
shadcn-vue
├── Button
├── Input
├── Textarea
├── Dialog
├── Sheet
├── Drawer
├── Dropdown Menu
├── Tabs
├── Tooltip
├── Popover
├── Command
├── Form
├── Table
├── Skeleton
└── 基础后台/工作台 UI

AI Elements Vue
├── conversation
├── message
├── prompt-input
├── reasoning
├── chain-of-thought
├── tool
├── task
├── plan
├── queue
├── sources
├── inline-citation
├── model-selector
├── suggestion
├── confirmation
├── code-block
├── image
├── artifact
└── canvas
```

这套组合更适合本项目，因为右侧不是传统客服聊天框，而是一个真正的 **Agent 操作面板**：

```text
用户输入
  │
  ▼
Prompt Input
  │
  ▼
AI Message
  │
  ├── Reasoning
  ├── Plan
  ├── Tool Call
  ├── Task Progress
  ├── Sources
  ├── Generated Image
  └── Confirmation
```

例如一次“把入口改到右侧，并扩大 LED 屏”的操作，可以直接在聊天流中展示：

```text
User Message
└── 修改入口和 LED

Assistant Message
├── Reasoning
│   └── 分析当前 V3 方案
│
├── Tool
│   ├── read_project_brief
│   └── read_selected_asset
│
├── Plan
│   ├── 调整入口
│   ├── 增加 LED 比例
│   └── 保持品牌主色
│
├── Tool
│   └── generate_image
│
├── Task
│   └── Generation 72%
│
└── Image
    └── V4 render
```

相比通用后台组件库，这种结构天然支持：

- AI 流式消息
- Tool Call 展示
- Agent Plan
- Reasoning 折叠
- 来源引用
- 模型切换
- 附件
- 任务队列
- 人工确认
- AI 生成图片
- 工作流节点

同时 AI Elements Vue 基于 shadcn-vue，组件代码会进入项目本身，后续可以直接修改成展览公司的视觉风格，而不是大量覆盖第三方组件 CSS。

#### UI 风格建议

整体界面建议偏：

```text
ChatGPT / Claude / Vercel AI
+
专业设计工作台
```

而不是传统：

```text
ERP / Admin Dashboard
```

推荐视觉原则：

```text
大面积中性色背景
细边框
低阴影
圆角 8~12px
对话内容弱气泡化
AI 回复尽量正文式展示
工具调用使用独立 Card
图片结果大面积展示
操作按钮靠近内容本身
```

Agent 回复不建议全部做成左右聊天气泡：

```text
用户
└── Bubble / Card

Assistant
└── Content Stream
    ├── Markdown
    ├── Tool
    ├── Image
    └── Actions
```

这样更像 Claude / ChatGPT 的 AI 工作台，也更适合复杂的展台设计任务。


#### 前端核心原则

```text
Pinia
└── 管“客户端状态”

TanStack Query
└── 管“服务端状态”

Fastify
└── 是数据唯一真源
```

不要把项目列表、图片列表、任务列表等 API 返回数据全部塞入 Pinia。

Pinia 推荐只保存：

```text
authStore
├── user
├── token / session state
└── permissions

appStore
├── sidebar
├── theme
└── global ui state

workspaceStore
├── activeProjectId
├── activeAssetId
├── selectedVersionId
├── compareMode
├── panelLayout
└── unsaved local editing state
```

TanStack Query 管理：

```text
projects
project detail
brief
assets
image versions
generation tasks
conversations
messages
knowledge search results
```

这样刷新、失效、重试、缓存、并发请求都由 Query 层处理。

#### 前端页面模块

```text
/
├── /login
│
├── /dashboard
│   ├── 今日项目
│   ├── 最近生成
│   ├── 待确认方案
│   └── 失败任务
│
├── /projects
│   ├── 项目列表
│   └── 新建项目
│
├── /projects/:projectId
│   ├── /overview
│   ├── /brief
│   ├── /assets
│   ├── /references
│   ├── /design
│   ├── /versions
│   ├── /conversation
│   └── /export
│
├── /knowledge
│   ├── 历史展台案例
│   ├── 材料知识
│   └── 公司内部资料
│
├── /tasks
│   ├── 生成中
│   ├── 已完成
│   └── 失败任务
│
└── /settings
    ├── 模型配置
    ├── Prompt
    ├── 存储配置
    └── 用户/权限
```

#### 设计工作台页面

`/projects/:projectId/design` 是整个产品最核心的页面。

建议采用三栏结构：

```text
┌──────────────────────────────────────────────────────────────┐
│ Topbar：项目 / 展会 / 保存状态 / 导出 / 当前模型            │
├───────────────┬──────────────────────────┬───────────────────┤
│ 左侧 Brief    │ 中间 Canvas / 图片区     │ 右侧 Agent        │
│               │                          │                   │
│ 尺寸          │ 当前方案大图             │ 对话               │
│ 开口          │ 多图网格                 │ 修改指令           │
│ 风格          │ V1/V2/V3                 │ Prompt             │
│ 品牌色        │ 对比                     │ 参数               │
│ 产品          │ 局部编辑                 │ 生成按钮           │
│ 参考图        │                          │                   │
└───────────────┴──────────────────────────┴───────────────────┘
```

核心组件：

```text
DesignWorkspace.vue
│
├── ProjectBriefPanel.vue
├── AssetLibraryPanel.vue
├── ReferencePanel.vue
│
├── GenerationCanvas.vue
│   ├── ImageGrid.vue
│   ├── ImagePreview.vue
│   ├── ImageCompare.vue
│   └── VersionTimeline.vue
│
├── AgentPanel.vue
│   ├── AIConversation.vue
│   │   └── AI Elements: conversation
│   │
│   ├── AIMessage.vue
│   │   ├── AI Elements: message
│   │   ├── reasoning
│   │   ├── sources
│   │   ├── tool
│   │   ├── task
│   │   └── image
│   │
│   ├── AgentPromptInput.vue
│   │   └── AI Elements: prompt-input
│   │
│   ├── AgentPlan.vue
│   │   └── AI Elements: plan
│   │
│   ├── AgentConfirmation.vue
│   │   └── AI Elements: confirmation
│   │
│   └── AgentModelSelector.vue
│       └── AI Elements: model-selector
│
└── GenerationToolbar.vue
    ├── SizeSelector.vue
    ├── CountSelector.vue
    └── GenerateButton.vue
```

#### 前端业务模块拆分

```text
src/modules/
├── auth/
├── dashboard/
├── customer/
├── project/
├── brief/
├── asset/
├── reference/
├── design/
├── generation/
├── conversation/
├── version/
├── knowledge/
├── export/
└── settings/
```

每个模块按功能内聚：

```text
modules/project/
├── api/
│   └── project.api.ts
├── components/
├── composables/
├── pages/
├── queries/
│   ├── project.queries.ts
│   └── project.mutations.ts
├── types/
└── index.ts
```

#### 前端推荐目录

```text
apps/web/
├── src/
│   ├── app/
│   │   ├── router/
│   │   ├── providers/
│   │   └── layouts/
│   │
│   ├── modules/
│   │   ├── auth/
│   │   ├── project/
│   │   ├── brief/
│   │   ├── asset/
│   │   ├── design/
│   │   ├── generation/
│   │   ├── conversation/
│   │   ├── knowledge/
│   │   └── settings/
│   │
│   ├── components/
│   │   ├── ui/                  # shadcn-vue
│   │   ├── ai-elements/         # AI Elements Vue
│   │   ├── common/
│   │   └── business/
│   │
│   ├── stores/
│   ├── composables/
│   ├── lib/
│   │   ├── api/
│   │   ├── query/
│   │   ├── storage/
│   │   └── utils/
│   │
│   ├── styles/
│   ├── types/
│   ├── App.vue
│   └── main.ts
│
├── vite.config.ts
└── package.json
```

#### API 调用方式

不建议手写大量：

```text
axios.get(...)
axios.post(...)
```

推荐：

```text
Fastify Route Schema
        │
        ▼
OpenAPI
        │
        ▼
自动生成 TypeScript Client
        │
        ▼
TanStack Query
        │
        ▼
Vue Component
```

这样后端接口字段变化时，前端可以直接通过 TypeScript 报错发现。

#### 图片上传

小文件可以：

```text
Vue
 ↓
Fastify multipart
 ↓
RustFS
```

大量高清图片建议：

```text
Vue
 │
 ├── POST /assets/presign
 │
 ▼
Fastify
 │
 └── 返回 presigned URL
        │
        ▼
Vue ───────────────► RustFS
        直接上传
        │
        ▼
POST /assets/complete
        │
        ▼
PostgreSQL assets
```

这样 20MB、50MB 甚至更大的展台效果图不会全部经过 Fastify 内存。

#### 实时状态

第一阶段推荐 **SSE 优先于 WebSocket**。

适合 SSE：

```text
Agent token stream
generation progress
queue status
thumbnail progress
review progress
export progress
```

接口：

```text
GET /api/tasks/:taskId/events
GET /api/conversations/:conversationId/stream
```

后续多人协同编辑、实时批注时再增加 WebSocket。


---

### Backend

服务端建议明确为：

```text
Node.js 22.21.1
Fastify 5.x
TypeScript
Drizzle ORM
PostgreSQL + pgvector
Redis + BullMQ
RustFS S3 API
Mastra
```

Fastify 不只是 REST API 层，而是整个业务服务的 **Application Backend / BFF / Orchestrator Gateway**。

#### 服务端框架职责

Fastify 负责：

- REST API
- OpenAPI / Swagger
- 用户认证与权限
- 客户与项目管理
- Brief 结构化数据
- 文件元数据
- Presigned Upload
- Agent 调用入口
- AI 会话管理
- 图片生成任务创建
- 图片版本树
- BullMQ Job 创建与查询
- SSE 任务进度
- RustFS S3 API 对接
- PostgreSQL 数据访问
- 审计日志
- 错误处理
- Rate Limit
- Health Check

真正耗时的图片生成、Embedding、缩略图、审核、ComfyUI 不直接在 Fastify Request 生命周期中执行。

#### 推荐 Fastify 插件

```text
@fastify/cors
@fastify/helmet
@fastify/jwt
@fastify/multipart
@fastify/swagger
@fastify/swagger-ui
@fastify/sensible
@fastify/rate-limit
@fastify/sse
@fastify/under-pressure
@fastify/type-provider-typebox
```

第二阶段有多人协作需求时再加入：

```text
@fastify/websocket
```

#### Schema / 类型

推荐：

```text
Fastify
+
TypeBox
+
@fastify/type-provider-typebox
```

Route 中同时定义：

```text
params
querystring
body
response
```

由 Fastify 完成运行时校验和序列化。

然后生成 OpenAPI，前端再从 OpenAPI 生成 Client。

避免：

```text
后端一份 interface
前端再手写一份 interface
文档再写一份 JSON
```

#### ORM

推荐：

```text
Drizzle ORM
Drizzle Kit
PostgreSQL
pgvector
```

原因：

- TypeScript 原生类型体验好
- SQL 感强，不会把复杂查询完全隐藏
- Migration 清晰
- PostgreSQL 支持好
- 可直接定义 pgvector vector 列和 HNSW 索引
- 对项目、图片、版本、任务这种关系模型比较合适

数据库层依然允许使用原生 SQL，特别是：

```text
复杂统计
pgvector similarity
批量更新
锁
CTE
窗口函数
```

#### 服务端分层

不要把所有逻辑写进 route handler。

推荐：

```text
Route
 ↓
Controller
 ↓
Service
 ↓
Repository / Provider / Queue
 ↓
PostgreSQL / RustFS / Redis / AI
```

职责：

```text
Route
└── URL、Schema、权限、HTTP 配置

Controller
└── 解析 Request，调用 Service，返回 Reply

Service
└── 核心业务规则、事务、跨模块编排

Repository
└── PostgreSQL 查询

Provider
└── 外部服务：S3、LLM、图片模型

Queue
└── BullMQ Producer

Worker
└── 异步任务执行
```

#### 服务端业务模块

```text
apps/api/src/modules/
├── auth/
├── users/
├── customers/
├── projects/
├── briefs/
├── assets/
├── references/
├── generations/
├── image-versions/
├── conversations/
├── agents/
├── knowledge/
├── prompts/
├── tasks/
├── exports/
└── settings/
```

每个模块：

```text
projects/
├── project.route.ts
├── project.controller.ts
├── project.service.ts
├── project.repository.ts
├── project.schema.ts
├── project.types.ts
└── index.ts
```

复杂模块可以继续拆：

```text
generations/
├── generation.route.ts
├── generation.controller.ts
├── generation.service.ts
├── generation.repository.ts
├── generation.queue.ts
├── generation.schema.ts
├── generation.events.ts
└── providers/
```

#### 具体服务端模块

##### 1. AuthModule

负责：

```text
登录
刷新 Token
退出
当前用户
角色
权限
```

接口：

```text
POST /api/auth/login
POST /api/auth/refresh
POST /api/auth/logout
GET  /api/auth/me
```

公司内部第一阶段：

```text
admin
designer
sales
viewer
```

先做 RBAC 即可。

---

##### 2. CustomerModule

负责：

```text
客户公司
联系人
品牌资料
历史项目
```

接口：

```text
GET    /api/customers
POST   /api/customers
GET    /api/customers/:id
PATCH  /api/customers/:id
DELETE /api/customers/:id
```

---

##### 3. ProjectModule

负责：

```text
展台项目
展会信息
尺寸
开口
预算
行业
状态
负责人
```

接口：

```text
GET    /api/projects
POST   /api/projects
GET    /api/projects/:id
PATCH  /api/projects/:id
DELETE /api/projects/:id
```

状态：

```text
draft
briefing
designing
reviewing
approved
archived
```

---

##### 4. BriefModule

负责把客户自然语言需求变成结构化数据。

建议字段：

```text
booth
├── width
├── depth
├── height
├── openSides
└── hallRestrictions

brand
├── primaryColor
├── secondaryColor
├── logoAssetId
└── visualKeywords

functionalAreas
├── reception
├── meeting
├── display
├── storage
├── led
└── demo

style
├── keywords
├── materials
└── forbiddenElements

budget
deadline
specialRequirements
```

接口：

```text
GET  /api/projects/:id/brief
PUT  /api/projects/:id/brief
POST /api/projects/:id/brief/parse
POST /api/projects/:id/brief/review
```

---

##### 5. AssetModule

统一处理：

```text
Logo
VI
产品图
参考图
生成图
Mask
缩略图
导出文件
```

接口：

```text
POST   /api/projects/:id/assets/presign
POST   /api/projects/:id/assets/complete
GET    /api/projects/:id/assets
GET    /api/assets/:assetId
DELETE /api/assets/:assetId
```

AssetModule 只保存：

```text
bucket
object_key
mime_type
width
height
checksum
metadata
```

不保存真实宿主机路径。

---

##### 6. GenerationModule

这是 AI 图片业务核心模块。

负责：

```text
创建生成任务
构建 Prompt
选择 Provider
选择模型
保存输入资产
写入 BullMQ
查询状态
取消任务
重试任务
保存生成结果
```

接口：

```text
POST /api/projects/:id/generations
GET  /api/projects/:id/generations
GET  /api/generations/:taskId
POST /api/generations/:taskId/cancel
POST /api/generations/:taskId/retry
GET  /api/generations/:taskId/events
```

创建任务时：

```text
HTTP Request
 │
 ▼
GenerationService
 │
 ├── 校验 project / brief
 ├── 创建 generation_tasks
 ├── 保存 input_assets
 ├── 选择 provider/model
 └── queue.add(...)
        │
        ▼
立即返回 taskId
```

不要让 HTTP 请求等待图片模型 30～120 秒。

---

##### 7. ImageVersionModule

负责：

```text
版本树
父图
派生图
选中方案
回滚
对比
收藏
```

接口：

```text
GET  /api/projects/:id/image-versions
POST /api/assets/:assetId/select
GET  /api/assets/:assetId/children
POST /api/assets/:assetId/edit
```

版本关系：

```text
V1 img_001
   ├── V2 img_004
   │      └── V3 img_009
   └── V2 img_005
```

不强制把版本理解成简单整数数组，数据库应保留 `parent_asset_id`，以支持分叉。

---

##### 8. ConversationModule

负责：

```text
项目对话
消息
模型回复
Tool Call
生成任务引用
资产引用
```

建议：

```text
conversations
messages
message_parts
tool_executions
```

消息可引用：

```text
asset_id
generation_task_id
brief_version
```

接口：

```text
POST /api/projects/:id/conversations
GET  /api/conversations/:id/messages
POST /api/conversations/:id/messages
GET  /api/conversations/:id/stream
```

---

##### 9. AgentModule

AgentModule 是 Fastify 与 Mastra 之间的桥。

Fastify 不直接把所有业务权限交给 Agent。

推荐：

```text
Fastify
 │
 ▼
AgentService
 │
 ▼
Mastra Agent
 │
 ├── Project Tool
 ├── Brief Tool
 ├── Asset Tool
 ├── Reference Search Tool
 ├── Image Generation Tool
 └── Review Tool
```

Tool 调业务 Service，而不是 Tool 自己直接写数据库。

正确：

```text
Mastra Tool
 ↓
GenerationService
 ↓
Repository / Queue
```

不建议：

```text
Mastra Tool
 ↓
直接 SQL
```

---

##### 10. KnowledgeModule

负责：

```text
历史案例
材料知识
施工知识
展台规则
公司案例
Embedding
向量搜索
RAG
```

接口：

```text
POST /api/knowledge/documents
GET  /api/knowledge/documents
POST /api/knowledge/search
POST /api/knowledge/reindex
```

数据结构建议分为：

```text
knowledge_documents
knowledge_chunks
knowledge_embeddings
```

不要把整份 PDF / PPT 文本直接塞进单条 embedding。

---

##### 11. PromptModule

负责 Prompt 版本化。

```text
prompt_templates
prompt_versions
prompt_variables
```

类型：

```text
brief_parse
design_direction
image_generate
image_edit
image_review
case_search
```

生产环境不要把核心 Prompt 散落在 route/service 文件中。

---

##### 12. TaskModule

统一查询 BullMQ 任务。

```text
image-generation
image-thumbnail
image-review
embedding
export
comfyui
```

接口：

```text
GET /api/tasks
GET /api/tasks/:id
GET /api/tasks/:id/events
```

---

##### 13. ExportModule

负责：

```text
客户提案图
选中方案打包
PDF
ZIP
高清图
项目交付包
```

导出属于异步任务：

```text
Fastify
 ↓
export queue
 ↓
Export Worker
 ↓
RustFS
```

---

#### Worker 进程

第一阶段建议 API 与 Worker 分开进程。

```text
apps/
├── api/
│   └── Fastify
│
├── worker/
│   ├── image-generation.worker.ts
│   ├── image-thumbnail.worker.ts
│   ├── image-review.worker.ts
│   ├── embedding.worker.ts
│   └── export.worker.ts
│
└── web/
```

部署时：

```text
container: web
container: api
container: worker
container: postgres
container: redis
container: rustfs
```

以后图片量变大，只需要横向增加 Worker：

```text
worker-1
worker-2
worker-3
```

无需增加 API 实例。

#### BullMQ 队列设计

```text
image-generation
image-postprocess
image-thumbnail
image-review
embedding
export
comfyui
```

Job payload 不要塞图片 Binary。

正确：

```json
{
  "taskId": "task_xxx",
  "projectId": "prj_xxx",
  "inputAssetIds": ["img_a", "img_b"],
  "provider": "gemini",
  "model": "..."
}
```

Worker 自己根据 assetId 去 PostgreSQL + RustFS 获取数据。

#### 图片生成 Worker 流程

```text
BullMQ
 │
 ▼
ImageGenerationWorker
 │
 ├── load generation_task
 ├── load project
 ├── load brief
 ├── load input assets
 ├── PromptBuilder
 ├── ImageProvider.generate()
 │
 ▼
download / receive generated image
 │
 ├── validate
 ├── metadata
 ├── thumbnail
 └── RustFS upload
        │
        ▼
PostgreSQL assets
        │
        ▼
image_versions
        │
        ▼
generation_tasks = success
        │
        ▼
publish progress
```

#### Service 之间的依赖原则

允许：

```text
GenerationService → AssetService
GenerationService → ProjectService
GenerationService → PromptService
AgentService → GenerationService
ExportService → AssetService
```

避免循环：

```text
ProjectService ↔ GenerationService
AssetService ↔ ProjectService
```

底层 Repository 不互相调用。

#### 事务边界

需要事务的操作：

```text
创建项目 + 初始化 brief
生成成功 + assets + image_versions + task success
删除项目 + 文件待删除记录
选择方案 + image_versions 状态更新
```

RustFS 不支持和 PostgreSQL 真正的跨系统 ACID，所以采用：

```text
DB transaction
+
outbox / cleanup job
```

例如文件上传成功、数据库写入失败时，放入垃圾文件清理队列。

#### 错误码

建议业务错误统一：

```text
AUTH_UNAUTHORIZED
AUTH_FORBIDDEN
PROJECT_NOT_FOUND
BRIEF_INVALID
ASSET_NOT_FOUND
GENERATION_PROVIDER_ERROR
GENERATION_TIMEOUT
TASK_NOT_FOUND
STORAGE_UPLOAD_FAILED
MODEL_RATE_LIMITED
```

HTTP 响应：

```json
{
  "code": "GENERATION_PROVIDER_ERROR",
  "message": "图片生成失败",
  "requestId": "req_xxx",
  "details": {}
}
```

前端不要依赖后端中文 message 判断逻辑。

#### 日志

Fastify 默认使用 Pino 体系，建议结构化日志：

```text
requestId
userId
projectId
taskId
conversationId
provider
model
latency
tokenUsage
imageCount
cost
errorCode
```

重点是 AI 成本必须可追踪到：

```text
项目
→ 会话
→ 任务
→ Provider
→ Model
```

#### Health Check

```text
GET /health/live
GET /health/ready
```

`ready` 检查：

```text
PostgreSQL
Redis
RustFS
```

AI Provider 不建议作为 ready 的硬依赖，否则模型供应商短暂异常会导致整个服务被摘除。


---

### 业务模块总览

在现有“项目、需求、素材、生成、版本、RAG”的基础上，建议把业务域正式划分为：

```text
Exhibition AI
│
├── IAM
│   ├── 用户
│   ├── 登录
│   └── 权限
│
├── CRM Lite
│   ├── 客户
│   └── 联系人
│
├── Project
│   ├── 项目
│   ├── 展会
│   └── 项目状态
│
├── Brief
│   ├── 展台尺寸
│   ├── 功能区
│   ├── 风格
│   ├── 品牌
│   └── 预算
│
├── Asset
│   ├── Logo
│   ├── 产品
│   ├── 参考图
│   ├── 生成图
│   └── 导出
│
├── Design
│   ├── 设计方向
│   ├── 图片生成
│   ├── 图片编辑
│   ├── 版本
│   └── 方案确认
│
├── Agent
│   ├── 对话
│   ├── Tool
│   ├── Workflow
│   └── Execution
│
├── Knowledge
│   ├── 历史案例
│   ├── 材料
│   ├── 公司知识
│   └── RAG
│
├── Task
│   ├── Queue
│   ├── Progress
│   └── Retry
│
└── Export
    ├── Proposal
    ├── ZIP
    └── 第二阶段 PDF/BOM
```

第一阶段真正要完成的是：

```text
Project
Brief
Asset
Design
Generation
Image Version
Conversation
Task
Knowledge Search
```

报价、BOM、施工图、多人实时协作放第二阶段。

### 推荐 Monorepo

建议使用：

```text
pnpm workspace
+
Turborepo（可选）
```

目录：

```text
exhibition-ai/
│
├── apps/
│   ├── web/                 # Vue 3.5.41
│   ├── api/                 # Fastify
│   └── worker/              # BullMQ Worker
│
├── packages/
│   ├── database/            # Drizzle schema / migrations
│   ├── contracts/           # 公共枚举、DTO 辅助类型
│   ├── ai/                  # Model Provider / AI SDK
│   ├── agent/               # Mastra
│   ├── storage/             # RustFS/R2/S3 Adapter
│   ├── queue/               # BullMQ Queue definitions
│   ├── config/              # env / shared config
│   ├── logger/              # logger
│   └── utils/
│
├── infra/
│   ├── docker/
│   │   ├── web.Dockerfile
│   │   ├── api.Dockerfile
│   │   └── worker.Dockerfile
│   ├── nginx/
│   │   └── default.conf
│   └── 1panel/
│       ├── docker-compose.yml
│       ├── .env.example
│       └── DEPLOY.md
│
├── data/
│   ├── postgres/
│   ├── redis/
│   └── rustfs/
│
├── docs/
│   ├── architecture/
│   ├── api/
│   └── prompts/
│
├── pnpm-workspace.yaml
└── package.json
```

依赖方向：

```text
web
└── 只依赖 contracts / generated api client

api
├── database
├── storage
├── queue
├── ai
└── agent

worker
├── database
├── storage
├── queue
└── ai

agent
├── ai
└── contracts
```

不建议 `web` 直接 import `database` 或 `agent`。

### 第一阶段部署拓扑

生产环境统一采用：

```text
1Panel
+
Docker Engine
+
Docker Compose
```

Node.js 不直接安装在服务器宿主机作为应用运行环境。

统一把 Node.js **22.21.1** 固定在 Docker 镜像中：

```text
开发机 / CI
└── Node.js 22.21.1

Docker
├── web build stage   → node:22.21.1-bookworm-slim
├── api               → node:22.21.1-bookworm-slim
└── worker            → node:22.21.1-bookworm-slim
```

这样本地开发、CI、API、Worker 使用同一个 Node patch 版本，避免不同环境产生依赖差异。

Web 为 Vue SPA，不需要在生产环境长期运行 Node Server。推荐使用多阶段构建：

```text
Node 22.21.1
   │
   └── pnpm build
          │
          ▼
        dist/
          │
          ▼
        Nginx
```

整体生产拓扑：

```text
Browser
   │
   ▼
HTTPS / Domain
   │
   ▼
1Panel OpenResty / Nginx
   │
   ├──────────────► web container
   │                 Vue SPA + Nginx
   │
   └── /api/* ─────► api container :3000
                         Fastify
                           │
              ┌────────────┼─────────────┐
              │            │             │
              ▼            ▼             ▼
          PostgreSQL      Redis         RustFS
                           │
                           ▼
                         BullMQ
                           │
                           ▼
                      worker container
                           │
                ┌──────────┼───────────┐
                ▼          ▼           ▼
             Gemini      Claude       GPT
                │
                ▼
           Image Provider
```

第一阶段 Docker Compose 服务建议固定为：

```text
exhibition-web
exhibition-api
exhibition-worker
exhibition-postgres
exhibition-redis
exhibition-rustfs
```

其中：

```text
web
└── Vue 构建产物 + Nginx

api
└── Node.js 22.21.1 + Fastify

worker
└── Node.js 22.21.1 + BullMQ Worker

postgres
└── PostgreSQL + pgvector

redis
└── BullMQ Queue / Cache

rustfs
└── S3 Compatible Object Storage
```

#### Docker 基础镜像

API 与 Worker 推荐：

```dockerfile
FROM node:22.21.1-bookworm-slim
```

不优先使用 Alpine。后续项目可能涉及 `sharp`、图片缩略图、字体、PDF、Canvas 或其他原生 npm 模块，Debian slim 系列通常更容易处理原生依赖。

Web 推荐多阶段构建：

```dockerfile
FROM node:22.21.1-bookworm-slim AS builder

WORKDIR /app
RUN corepack enable

COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter web build

FROM nginx:alpine
COPY --from=builder /app/apps/web/dist /usr/share/nginx/html
```

#### 1Panel 持久化目录

生产数据不要只保存在容器 writable layer 中。建议服务器统一使用：

```text
/opt/exhibition-ai/
├── postgres/
├── redis/
├── rustfs/
├── logs/
└── backups/
```

Docker Compose 将 PostgreSQL、Redis、RustFS 挂载到这些目录。

仓库中的 `data/` 主要用于本地开发；生产环境实际数据以服务器挂载目录为准。

#### 1Panel 反向代理

公网只暴露 HTTPS 域名，例如：

```text
https://ai.example.com
```

推荐路由：

```text
/          → web
/api/*     → api:3000
```

PostgreSQL、Redis、RustFS 的内部服务端口默认只加入 Docker 内部网络，不直接暴露公网。

项目使用 SSE 传输 Agent 输出和任务进度，因此 1Panel / OpenResty 反代 API 时需要关闭代理缓冲：

```nginx
proxy_buffering off;
proxy_cache off;
proxy_http_version 1.1;
proxy_set_header Connection '';
proxy_read_timeout 3600s;
```

#### 部署原则

```text
1Panel
├── 管理网站 / 域名 / HTTPS
├── 管理 Docker / Compose
├── 查看容器日志
├── 查看 CPU / 内存 / 网络
└── 执行容器重启与更新

Docker Compose
├── 定义应用服务
├── 定义内部网络
├── 定义环境变量
├── 定义持久化 Volume
└── 定义 Health Check
```

不建议同时再使用宿主机 PM2 运行 Fastify。既然生产环境已经统一 Docker 化，API 与 Worker 都由 Docker Compose 管理。

### MVP 开发顺序

```text
Phase 1
├── Monorepo
├── Fastify 基础工程
├── PostgreSQL / Drizzle
├── RustFS
├── Vue 基础后台
└── Auth

Phase 2
├── Project
├── Brief
├── Asset
└── Presigned Upload

Phase 3
├── BullMQ
├── Generation Task
├── Image Worker
├── Image Provider
└── Generation Result

Phase 4
├── Design Workspace
├── Image Version
├── SSE Progress
└── 方案选择

Phase 5
├── Mastra
├── Conversation
├── Tool
└── Agent 修改图片工作流

Phase 6
├── pgvector
├── Knowledge
├── 历史案例检索
└── Reference Recommendation

Phase 7
├── Export
├── Audit Log
├── Cost Tracking
└── 稳定性/监控
```

### 最终建议的“具体技术栈”

```text
Frontend
├── Vue 3.5.41
├── TypeScript
├── Vite 8
├── Vue Router 5
├── Pinia 3
├── TanStack Vue Query v5
├── shadcn-vue
├── AI Elements Vue 1.5.x
├── Tailwind CSS 4
├── SSE
├── Vitest
└── Playwright

Backend
├── Node.js 22.21.1
├── Fastify 5
├── TypeScript
├── TypeBox
├── OpenAPI / Swagger
├── Drizzle ORM
├── PostgreSQL
├── pgvector
├── Redis
├── BullMQ
├── Pino
└── SSE

AI
├── Mastra
├── Vercel AI SDK
├── Gemini
├── Claude
├── GPT
└── Provider Adapter

Image
├── Nano Banana 2
├── Nano Banana Pro
├── GPT-Image-2
└── ComfyUI（第二阶段）

Storage
├── RustFS
├── S3 API
└── Local Disk

Infra
├── 1Panel
├── Docker Engine
├── Docker Compose
├── node:22.21.1-bookworm-slim
├── 1Panel OpenResty / Nginx
├── HTTPS / Reverse Proxy
└── pnpm workspace
```


---

### Agent

```text
Mastra
```

主要用于：

- Agent
- Workflow
- Tools
- Memory
- RAG
- Structured Output
- Human-in-the-loop
- 多模型调度

建议第一阶段采用：

```text
1 个主 Agent
+
多个 Tool
+
Workflow
```

而不是一开始拆成大量独立 Agent。

后续可以逐步拆分：

```text
BoothAgent
├── BriefAgent
├── DesignAgent
├── ReferenceAgent
├── ImageAgent
└── ReviewAgent
```

---

### LLM

```text
Gemini
Claude
GPT
```

建议用途：

| 模型 | 主要用途 |
|---|---|
| Gemini | 多模态理解、图片分析、方案生成 |
| Claude | 需求分析、复杂设计推理、Agent |
| GPT | 通用 Agent、结构化输出、多模态 |

具体模型通过 Provider Adapter 统一接入，避免业务代码绑定某一家模型。

---

### Image

```text
Nano Banana 2
Nano Banana Pro
GPT-Image-2
```

建议分工：

```text
Nano Banana 2
└── 日常草稿、快速方案生成、修改图

Nano Banana Pro
└── 精品效果图、客户最终方案

GPT-Image-2
└── 第二图片引擎 / 备用模型
```

图片引擎建议在业务层抽象：

```text
ImageProvider
├── GeminiImageProvider
├── OpenAIImageProvider
└── ComfyUIProvider
```

---

### AI SDK

```text
Vercel AI SDK
```

主要作为模型 Provider 抽象层使用。

负责统一：

- Gemini
- Claude
- GPT
- 图片模型

---

### Database

```text
PostgreSQL
pgvector
```

PostgreSQL 保存：

- 用户
- 客户
- 展台项目
- 项目需求
- AI 会话
- Prompt
- 图片元数据
- 图片版本
- 生成任务
- Agent 执行记录
- RAG 文档信息

pgvector 保存：

- 历史案例 Embedding
- 项目需求 Embedding
- 展台设计知识
- 公司内部案例知识库

---

### Object Storage

```text
RustFS
S3 Compatible
Local Disk
```

RustFS 用于保存：

- Logo
- 品牌素材
- 产品图片
- 客户参考图片
- AI 生成图片
- 高清效果图
- 缩略图
- Mask
- ComfyUI 输出
- 导出文件

RustFS 数据实际落到服务器本地磁盘。

应用层统一走 S3 API，不直接依赖操作系统文件路径。

---

### Queue

```text
Redis
BullMQ
```

用于处理耗时任务：

- AI 图片生成
- 批量生成方案
- 图片压缩
- 缩略图生成
- Embedding
- ComfyUI
- 图片审核
- 导出任务

示例：

```text
Fastify
   │
   ▼
BullMQ
   │
   ├── image-generation
   ├── image-thumbnail
   ├── image-review
   ├── embedding
   └── export
```

---

### Advanced Image

第二阶段：

```text
ComfyUI
```

用于：

- ControlNet
- Depth
- Sketch
- LoRA
- Mask
- Inpainting
- 局部重绘
- 固定展台结构
- 企业自有模型
- 更精确的空间控制

架构：

```text
Mastra
   │
   ▼
ComfyUI Tool
   │
   ▼
ComfyUI API
   │
   ▼
Workflow
   │
   ▼
RustFS
```

---

# 3. 最终技术架构

```text
                    Vue 3.5.41
                 TypeScript
              shadcn-vue
            AI Elements Vue
                 Tailwind
                    │
                    ▼
                Fastify API
                    │
        ┌───────────┼──────────────┐
        │           │              │
        ▼           ▼              ▼
     Mastra      PostgreSQL      BullMQ
        │         pgvector          │
        │                           ▼
        │                         Redis
        │
        ├───────────┬───────────────┐
        │           │               │
        ▼           ▼               ▼
     Gemini       Claude           GPT
        │                           │
        └───────────┬───────────────┘
                    │
                    ▼
               Image Provider
                    │
       ┌────────────┼────────────┐
       │            │            │
       ▼            ▼            ▼
Nano Banana 2   NB Pro     GPT-Image-2
                                  │
                                  │
                         第二阶段：ComfyUI
                                  │
                                  ▼
                                RustFS
                                  │
                                  ▼
                             Local Disk
```

---

# 4. 文件关系设计

## 4.1 核心原则

PostgreSQL：

```text
保存“文件是什么”
```

RustFS：

```text
保存“文件本身”
```

不要把高清图片 Binary / Base64 直接存进 PostgreSQL。

---

## 4.2 Bucket 设计

建议第一阶段使用一个 Bucket：

```text
exhibition-ai
```

内部通过 Object Key 区分业务。

---

## 4.3 Object Key 目录结构

```text
exhibition-ai/
│
├── projects/
│   └── {projectId}/
│       │
│       ├── brand/
│       │   ├── logo/
│       │   ├── vi/
│       │   └── fonts/
│       │
│       ├── products/
│       │
│       ├── references/
│       │
│       ├── generations/
│       │   ├── v1/
│       │   ├── v2/
│       │   ├── v3/
│       │   └── ...
│       │
│       ├── masks/
│       │
│       ├── thumbnails/
│       │
│       ├── comfyui/
│       │
│       └── exports/
│
├── knowledge/
│   ├── booth-cases/
│   ├── materials/
│   └── company/
│
└── temp/
```

---

# 5. 项目文件示例

例如项目：

```text
project_id = prj_01JABC123
```

RustFS：

```text
exhibition-ai
└── projects
    └── prj_01JABC123
        ├── brand
        │   └── logo
        │       └── logo.png
        │
        ├── products
        │   ├── product-01.png
        │   └── product-02.png
        │
        ├── references
        │   ├── reference-01.jpg
        │   └── reference-02.jpg
        │
        └── generations
            ├── v1
            │   ├── render-01.webp
            │   ├── render-02.webp
            │   └── render-03.webp
            │
            └── v2
                ├── render-01.webp
                └── render-02.webp
```

---

# 6. PostgreSQL 与 RustFS 文件关系

整体关系：

```text
projects
   │
   │ 1:N
   ▼
assets
   │
   ├──────────────► RustFS Object
   │
   │ 1:N
   ▼
image_versions
   │
   │
   ▼
generation_tasks
```

例如：

```text
PostgreSQL
│
├── projects
│     └── prj_01JABC123
│
├── assets
│     └── img_001
│           bucket = exhibition-ai
│           object_key =
│           projects/prj_01JABC123/generations/v3/render-01.webp
│
└── image_versions
      └── version = 3

                    │
                    ▼

                 RustFS
                    │
                    ▼

exhibition-ai/
projects/
prj_01JABC123/
generations/
v3/
render-01.webp
```

---

# 7. PostgreSQL 表设计

## 7.1 projects

保存展台项目。

```sql
CREATE TABLE projects (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,

    exhibition_name VARCHAR(255),

    booth_width NUMERIC(10,2),
    booth_depth NUMERIC(10,2),
    booth_height NUMERIC(10,2),

    open_sides SMALLINT,

    budget NUMERIC(15,2),

    industry VARCHAR(100),
    style VARCHAR(100),

    status VARCHAR(50) DEFAULT 'draft',

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 7.2 assets

所有文件统一登记到 assets 表。

```sql
CREATE TABLE assets (
    id VARCHAR(64) PRIMARY KEY,

    project_id VARCHAR(64)
        REFERENCES projects(id)
        ON DELETE CASCADE,

    asset_type VARCHAR(50) NOT NULL,

    bucket VARCHAR(100) NOT NULL,
    object_key TEXT NOT NULL,

    original_filename VARCHAR(255),
    mime_type VARCHAR(100),

    file_size BIGINT,

    width INTEGER,
    height INTEGER,

    checksum VARCHAR(128),

    metadata JSONB,

    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

`asset_type` 建议：

```text
logo
vi
product
reference
generation
thumbnail
mask
comfyui
export
```

---

# 8. PostgreSQL 图片保存示例

例如生成：

```text
projects/prj_01JABC123/generations/v3/render-01.webp
```

PostgreSQL 保存：

```json
{
  "id": "img_01JXYZ001",
  "projectId": "prj_01JABC123",
  "assetType": "generation",
  "bucket": "exhibition-ai",
  "objectKey": "projects/prj_01JABC123/generations/v3/render-01.webp",
  "originalFilename": "render-01.webp",
  "mimeType": "image/webp",
  "fileSize": 10485760,
  "width": 2048,
  "height": 2048
}
```

注意：

PostgreSQL 不保存：

```text
/data/exhibition-ai/xxx
```

也不要保存服务器真实磁盘路径。

只保存：

```text
bucket
+
object_key
```

这样以后从 RustFS 迁移：

```text
RustFS
   ↓
Cloudflare R2
```

或者：

```text
RustFS
   ↓
AWS S3
```

数据库中的文件关系基本不需要改变。

---

# 9. 图片版本表

因为 AI 展台设计一定会反复修改，所以建议独立保存版本关系。

```sql
CREATE TABLE image_versions (
    id VARCHAR(64) PRIMARY KEY,

    project_id VARCHAR(64)
        REFERENCES projects(id)
        ON DELETE CASCADE,

    asset_id VARCHAR(64)
        REFERENCES assets(id)
        ON DELETE CASCADE,

    parent_asset_id VARCHAR(64)
        REFERENCES assets(id),

    version INTEGER NOT NULL,

    prompt TEXT,

    edit_instruction TEXT,

    provider VARCHAR(50),
    model VARCHAR(100),

    seed VARCHAR(100),

    is_selected BOOLEAN DEFAULT FALSE,

    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

例如：

```text
V1
│
├── img_001
├── img_002
└── img_003

用户选择 img_002
       │
       ▼
       V2
       │
       ├── img_004
       └── img_005

用户选择 img_005
       │
       ▼
       V3
       │
       └── img_006 ★
```

这样可以完整保留 AI 图片修改历史。

---

# 10. AI 生成任务表

图片生成通常是异步任务，建议保存任务记录。

```sql
CREATE TABLE generation_tasks (
    id VARCHAR(64) PRIMARY KEY,

    project_id VARCHAR(64)
        REFERENCES projects(id)
        ON DELETE CASCADE,

    task_type VARCHAR(50) NOT NULL,

    provider VARCHAR(50),
    model VARCHAR(100),

    prompt TEXT,

    input_assets JSONB,

    status VARCHAR(50) DEFAULT 'pending',

    progress INTEGER DEFAULT 0,

    result_assets JSONB,

    error_message TEXT,

    started_at TIMESTAMPTZ,
    finished_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

状态：

```text
pending
processing
success
failed
cancelled
```

---

# 11. 图片生成完整数据流

```text
用户
 │
 ▼
Vue 3.5.41
 │
 ▼
POST /api/projects/:id/generate
 │
 ▼
Fastify
 │
 ├── PostgreSQL 创建 generation_task
 │
 ▼
BullMQ
 │
 ▼
Image Worker
 │
 ▼
Mastra / Image Provider
 │
 ├── Nano Banana 2
 │
 ├── Nano Banana Pro
 │
 └── GPT-Image-2
 │
 ▼
生成图片
 │
 ▼
RustFS
 │
 ▼
保存 Object Key
 │
 ▼
PostgreSQL assets
 │
 ▼
image_versions
 │
 ▼
generation_task = success
 │
 ▼
Vue3 展示结果
```

---

# 12. 推荐 Storage Adapter

业务代码不要直接绑定 RustFS。

定义：

```ts
interface StorageProvider {
  upload(
    path: string,
    data: Buffer,
    contentType?: string
  ): Promise<StorageObject>;

  delete(path: string): Promise<void>;

  exists(path: string): Promise<boolean>;

  getUrl(path: string): Promise<string>;

  getPresignedUrl(
    path: string,
    expiresIn?: number
  ): Promise<string>;
}
```

实现：

```text
StorageProvider
│
├── RustFSStorageProvider
│
├── R2StorageProvider
├── S3StorageProvider
└── MinioStorageProvider
```

当前：

```text
StorageProvider
       │
       ▼
RustFSStorageProvider
```

未来切换云存储，不需要修改 Agent 和业务逻辑。

---

# 13. Docker 数据持久化

RustFS 数据必须挂载到宿主机磁盘。

推荐：

```text
project/
├── docker-compose.yml
├── apps/
├── packages/
└── data/
    ├── rustfs/
    ├── postgres/
    └── redis/
```

Docker Volume：

```yaml
volumes:
  - ./data/rustfs:/data
```

实际关系：

```text
Docker RustFS
      │
      ▼
    /data
      │
      ▼
宿主机
./data/rustfs
```

即使重新创建 Docker Container，图片也不会丢失。

---

# 14. 推荐最终方案

```text
Web
Vue 3.5.41 + TypeScript
shadcn-vue + AI Elements Vue + Tailwind CSS

Backend
Node.js
Fastify

Agent
Mastra

LLM
Gemini / Claude / GPT

Image
Nano Banana 2
Nano Banana Pro
GPT-Image-2

AI SDK
Vercel AI SDK

Database
PostgreSQL
pgvector

Object Storage
RustFS
S3 Compatible
Local Disk

Queue
Redis
BullMQ

Advanced Image
ComfyUI
```

---

# 15. 核心原则总结

### PostgreSQL

负责：

```text
项目
用户
需求
Prompt
图片元数据
图片版本
AI 任务
文件关系
RAG
```

### RustFS

负责：

```text
Logo
产品图
参考图
生成图
缩略图
Mask
高清图
导出文件
ComfyUI 文件
```

### Redis + BullMQ

负责：

```text
图片生成队列
图片处理队列
Embedding 队列
ComfyUI 队列
```

最终形成：

```text
PostgreSQL
     │
     │ object_key
     ▼
   RustFS
     │
     ▼
 Local Disk
```

这是第一阶段最推荐的存储关系。
