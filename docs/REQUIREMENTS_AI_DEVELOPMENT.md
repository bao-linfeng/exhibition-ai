# 展台 AI 设计平台：产品需求与工程实施规范

版本：1.0 · 编写日期：2026-09-14 · 面向：产品、设计、开发、测试及后续 AI 编程 Agent

本文将 [原始技术选型文档](./TECH_STACK_AI_UI.md) 转化为可实施、可验收的开发基线。原文保留作为背景；后续开发遇到两份文档冲突时，以本文的范围、命名、接口和业务规则为准。改变本文基线需要记录原因及影响，不得由 AI 在实现过程中自行扩大范围。

当前仓库仅发现原始需求文档，未发现应用源码、依赖清单或锁文件。本文描述的是**目标工程与待实现要求**，不是已经完成的功能或验证结果。本文不声称已安装依赖、运行集成测试或验证真实模型账号。

## 1. 优化结论与决策基线

原方案的 Vue SPA、Fastify、PostgreSQL、对象存储和异步 Worker 方向合理。主要问题是功能范围过宽、规则不闭合、目录职责有重叠，并且部分版本号及模型名称被当成已确认事实。

| 原方案问题 | 本文决定 | 对实施的影响 |
|---|---|---|
| 技术清单和未来能力混在一起 | 明确 MVP、P1、P2；MVP 有逐项验收条件 | AI 不提前实现 RAG、BOM、施工图 |
| 固定旧 Node patch，同时标注多个依赖为最新 | 新项目默认 Node 24 LTS；依赖在 M0 核实并锁定 patch | 避免复制过时版本和混装不兼容包 |
| API 内定义所有 Service，Worker 又需要相同规则 | 共用服务端业务放 `packages/backend`；应用仅负责入口和装配 | Worker 不导入 `apps/api/src` |
| 全局 `components/business`、模块 components、全局 types 并存 | 业务组件归所属模块，全局仅通用 UI 与基础能力 | 减少同类代码散落 |
| 强制 Route → Controller → Service 全套样板 | 薄 Route 调 Service；仅在 HTTP 适配复杂时加 Controller | 保留分层，避免无意义转发 |
| Pinia 保存 Token，SSE 未定义认证 | 同源 HttpOnly Cookie Session；Pinia 只存用户摘要 | 刷新和 SSE 采用同一认证机制 |
| 数据库写任务后直接 `queue.add` | PostgreSQL 事务写任务与 Outbox，异步可靠投递 | Redis 故障不会静默丢任务 |
| 任务状态、接口名存在多套定义 | `/api/v1`、统一 Task 状态、统一事件协议 | 前后端按同一契约开发 |
| 版本号和文件路径耦合，选中标志缺少约束 | 不可变资产、版本父子关系、项目单一选中指针 | 支持分叉与并发选图 |
| RustFS 全内网但浏览器需要直传 | 私有 Bucket + 对外 HTTPS S3 入口 + 短期签名 | 直传链路可以真实访问 |
| Mastra、AI SDK、图片 Provider 职责重叠 | Mastra 管 Agent；独立 ImageProvider 管图片能力 | 不假设所有模型都有统一图片接口 |
| 展示完整 Reasoning 与虚构百分比 | 只显示可公开的执行摘要、工具状态与真实进度 | 不展示隐藏思维链，不伪造 72% |
| 审计和费用放到最后 | 从首次真实生成就记录审计、用量和费用状态 | 能追踪重复请求、取消与计费 |

### 1.1 产品默认假设

以下是为使需求可执行而确定的默认值，可经产品确认后调整；它们不是从原文中已经确认的事实。

- 第一版部署给一家展览公司内部使用，简体中文、单组织；不做开放注册、跨公司 SaaS、订阅计费。
- 非管理员只能访问自己参与的项目；同一项目内素材和会话共享。客户联系人不获得系统登录权限。
- 输出为设计概念效果图。尺寸、预算和场馆规则作为设计输入与人工检查项，不作为结构安全、消防合规或施工可行性的自动认证。
- MVP 必须具备自然语言调整图片能力；暂不承诺局部 Mask 编辑、精确三维尺寸、同一结构多视角严格一致、品牌文字像素级准确。
- MVP 默认首轮生成 3 张，单批允许 1～4 张；全部可形成独立分支。实际尺寸和格式取已配置模型支持的交集。
- 初始容量目标为 20 个同时在线用户；单用户最多 2 个、全系统最多 4 个正在执行的图片请求，排队最多 100 个图片输出单元。
- 每次真实付费调用必须有可用账号、能力验证和管理员配置的额度；未配置时以清楚标识的 Mock 完成开发，不暗中使用真实付费服务。

### 1.2 范围与交付定义

| 阶段 | 必须包含 | 明确排除 |
|---|---|---|
| MVP（M0～M5） | 登录和项目权限；客户/项目；Brief 版本；图片上传；设计方向；生成/修改；持久化任务；版本比较/选中；项目对话和人工确认；原图/ZIP 导出；审计、费用和备份 | RAG、全文文档解析、施工图、BOM、自动报价、实时多人编辑 |
| P1 | 历史案例知识库、文档检索与引用、PDF 提案、多个真实图片 Provider、收藏与标签增强、Prompt 管理界面 | 不改变 MVP 已保存的版本和任务语义 |
| P2 | ComfyUI、Mask/局部重绘、草图/深度控制、精细图像编辑；另立需求评估 BOM 和报价 | 不把生成效果图直接转换为可施工承诺 |

MVP 完成意味着：从空数据库部署后，有权限的用户能创建项目、确认需求、上传资料、生成多个方向、选择并修改图片、刷新后恢复任务与历史、导出结果；越权、重复提交、断线和 Worker 重启均有可验证结果。真实 Provider 冒烟测试是上线条件，Mock 测试不能代替。

## 2. 用户角色、权限与项目生命周期

### 2.1 权限矩阵（FR-01）

角色存于用户，项目关系存于 `project_members`。有效权限 = 用户角色允许的操作 ∩ 项目成员范围；`admin` 可访问全部项目。任何页面隐藏按钮都不能代替服务端校验。

| 操作 | admin | designer | sales | viewer |
|---|---|---|---|---|
| 查看参与项目、素材、历史、导出原图/ZIP | 全部项目 | 是 | 是 | 是 |
| 创建项目、创建/维护可访问客户 | 是 | 是 | 是 | 否 |
| 编辑 Brief、上传/隐藏素材 | 是 | 是 | 是 | 否 |
| AI 解析 Brief（仅产生候选，消耗文本额度） | 是 | 是 | 是 | 否 |
| 生成方向、生成/修改图片、发起 Agent 会话 | 是 | 是 | 否 | 否 |
| 选择方案、发起评审 | 是 | 是 | 否 | 否 |
| 批准/退回方案 | 是 | 否 | 是 | 否 |
| 管理项目成员与负责人 | 是 | 仅作为负责人 | 仅作为负责人 | 否 |
| 归档/恢复项目 | 是 | 仅作为负责人 | 仅作为负责人 | 否 |
| 用户启停/角色、模型和额度设置、物理清理 | 是 | 否 | 否 | 否 |

负责人权限只增加成员管理与归档能力，不提升角色的生成/批准权限。创建者自动成为负责人和成员。负责人必须是启用的 designer、sales 或 admin；移除负责人前必须转交。非管理员新增成员不能赋予用户全局角色，也不能移除最后一个负责人。

客户对非管理员的可见范围：自己创建的客户，或与自己参与项目关联的客户。客户资料编辑限创建者或关联项目负责人；关联前重新校验可访问性。停用客户只禁止新项目关联，不破坏历史。

所有子资源，包括下载签名、SSE、任务、会话、费用、导出，必须沿项目验证权限。无权访问具体资源统一返回 404；已能访问资源但操作权限不足返回 403。撤销成员关系后新请求立即生效，已有 SSE 最迟 30 秒断开；已签发下载 URL 最迟 5 分钟到期。

认证采用账号密码和数据库 Session；密码使用维护中的 Argon2id 实现，不存明文。生产 Cookie 使用 `HttpOnly`、`Secure`、`SameSite=Lax`、`Path=/`。Session 空闲 8 小时、绝对 7 天到期；退出或用户停用后失效。禁止将访问凭证放 localStorage。变更请求验证可信 Origin 与 Session 绑定的 CSRF Token；登录同样验证 Origin。连续登录失败按账号与 IP 限流。

MVP 不开放注册和邮件找回；管理员通过受控命令创建用户/重置临时密码，用户首登必须修改密码。Web 提供修改本人密码、管理员查看/停用用户/更改角色；不允许停用最后一位启用的管理员。

### 2.2 项目状态（FR-02）

```text
draft → briefing → designing → reviewing → approved
                         ↑          │
                         └──────────┘ 退回并填写原因
任一非归档状态 → archived → 恢复到归档前状态
approved → designing（显式重新打开，保留历史批准记录）
```

- 创建为 `draft`；首次保存有效 Brief 进入 `briefing`；确认 Brief 后进入 `designing`。
- `designing` 中产生首张图不会自动进入评审。提交评审必须已有选中版本，且无进行中的生成/修改任务。
- 批准时记录批准人、时间、选中版本及 Brief revision。审核者代表内部审批，不等价于客户签字。
- `reviewing`、`approved` 不接受修改 Brief、选中版本或新生成；先退回/重新打开。历史版本始终可读。
- 归档前必须没有活跃任务和待确认 Agent 操作；否则返回 409 并展示阻塞项。归档项目只读；恢复不得绕过角色权限。
- MVP 不提供项目物理删除。素材删除为隐藏；被历史引用的文件不能物理清理。

## 3. 功能需求与业务规则

### 3.1 客户、项目与列表（FR-03）

项目必填：名称（1～120 字）、客户、负责人。可选：展会名称、展馆/展位号、开展日期、交付截止日期、行业、备注。负责人和客户必须可访问。允许同名项目，以 ID 区分。

项目列表支持关键词、客户、负责人、状态、更新时间过滤；默认 `updatedAt DESC, id DESC`，游标分页每页 20，最多 100。仪表盘只聚合当前用户可见范围内的最近项目、活跃任务和失败任务。

表单保存使用乐观锁 `revision`。过期修改返回 409，提示加载最新内容并保留本地未保存输入，不静默覆盖他人修改。

### 3.2 结构化 Brief（FR-04）

| 字段 | 类型与校验 | 生成前要求 |
|---|---|---|
| `booth.widthM/depthM/heightLimitM` | 正数，最多两位小数；单位米，0 < 值 ≤ 100 | 必填 |
| `booth.openSides` | `front/right/back/left` 无重复数组，1～4 项 | 必填；方向基于平面俯视图，front 为展示正面 |
| `booth.hallRestrictions` | 最长 4000 字 | 可空，空值显示“未提供”，不解释为无限制 |
| `brand.name` | 1～120 字 | 必填 |
| `brand.primaryColor/secondaryColor` | `#RRGGBB` | 可选 |
| `brand.logoAssetId` | 本项目 ready 的 Logo 图片 | 可选；不可访问则拒绝 |
| `brand.visualKeywords` | 最多 10 项，每项 40 字 | 可选 |
| `functionalAreas` | reception/meeting/display/storage/led/demo；每项有 required、数量、说明 | 至少 1 项 required |
| `style.keywords/materials/forbiddenElements` | 各最多 20 项，每项 80 字 | 风格关键词至少 1 项 |
| `budget.amountMinor/currency` | 非负整数最小货币单位；MVP 仅 CNY | 可空，预算不直接用于 AI 调用额度 |
| `deadline` | ISO 日期 `YYYY-MM-DD` | 可选，不得晚于已填写的开展日期 |
| `specialRequirements` | 最长 8000 字 | 可选 |

面积由宽×深计算，不额外保存可独立修改的面积。尺寸和预算以 Brief 为唯一业务来源，项目列表通过关联读取，不在 projects 重复维护。

自然语言解析异步返回候选字段、缺失项和待核对项；不自动覆盖已保存 Brief。用户检查后保存新 revision，再显式确认。每次修改产生不可变快照，取消当前确认状态；新生成必须使用当前已确认 revision。

修改旧图时若其来源 Brief 与当前不同，必须显示差异并让用户确认“以当前 Brief 继续修改”，将确认写入新任务快照。旧版本保持原有来源。

### 3.3 素材管理与上传（FR-05）

MVP 上传种类：Logo、产品图、参考图、品牌资料图片；允许 PNG/JPEG/WebP，单文件最大 25 MiB、最多 40MP，每批最多 10 文件、每项目累计上传最多 2 GiB。SVG、GIF、PDF、PPT、字体文件暂不接收，界面明确说明。限制同时存在于服务端和 UI。

流程：申请 upload session → 浏览器 PUT 到临时对象 → complete → 异步校验和生成缩略图 → ready。文件名仅作展示，不能决定 object key。校验实际文件头、解码结果、大小和像素数；完成前不可用于生成。

同一 complete 重复调用返回同一资产/校验任务。客户端声称上传完成不代表资产已通过校验。校验失败保留可理解错误；允许重新上传，不能把损坏文件标为 ready。

展示缩略图、文件名、类型、尺寸、上传者、上传时间和处理状态；支持过滤和分页。隐藏素材后从新选择器移除，历史版本仍能访问其已有引用。正在使用的输入禁止物理删除。

### 3.4 设计方向与图片生成（FR-06）

“生成设计方向”基于确认后的 Brief 和选定 ready 素材，默认返回 3 个结构化方向，每项包含标题、概念说明、布局描述、材料/配色、限制核对清单、待人工确认问题。不把建议标为已验证施工结论。

用户选择方向并检查生成参数后创建图片任务。只允许服务端启用的模型配置 ID；请求不接受任意 Provider URL、API key、裸模型名或费用单价。

输入快照必须包括：Brief revision、设计方向、用户指令、素材 ID、父版本 ID（修改时）、尺寸/数量、模型配置及真实模型 ID、Prompt 模板版本、最终 Prompt、能力配置版本、创建者、额度预留。

生成结果每张独立保存；默认不自动改变选中方案。部分图片成功时保留结果并标为 `partially_succeeded`，用户可仅重试失败输出。格式、尺寸、负面提示词、Seed 等只在 Provider 明确支持时暴露；不支持时禁止提交，不能静默忽略。

自然语言修改必须指定父版本，可附加不超过模型限制的参考素材。模型必须具备 image-to-image/edit 能力；不支持时操作禁用并说明原因，不能把纯文生图伪装成保留原图结构的修改。

### 3.5 任务列表与控制（FR-07）

任务中心展示类型、项目、创建者、阶段、已完成张数/请求张数、开始时间、耗时、费用状态、可恢复错误与操作。只有真实可量化时才显示百分比，否则显示“排队中”“生成中”“正在保存”等阶段。

用户重复点击生成不重复创建任务。取消属于尽力而为：排队任务可直接取消；已调用 Provider 的任务显示“取消请求已提交，费用可能已产生”。界面必须区分取消请求与取消完成。状态转换、重试和异常恢复以第 8 节为准。

### 3.6 图片版本、比较与选中（FR-08）

每张成功图片对应一个不可变 `image_version` 和一个主 asset。父关系使用 `parentVersionId`；没有父版本即根方案，用户上传参考图不自动成为版本。

项目内 `sequence` 单调递增且唯一，仅用于 V1/V2 展示。批次和父子关系决定分组，不把“同一批 3 张”解释为共用一个唯一版本号。版本序号允许有空洞。

支持网格、原图预览、两图并排比较、父子历史、选择为当前方案、从任意历史版本继续修改。切换回历史方案只是更新项目 `selectedVersionId`，不删除后续分支。项目最多一个选中版本，选择需要 revision 防止并发覆盖。

### 3.7 项目会话与 Agent（FR-09）

MVP 一个项目一个默认共享会话，不做跨项目长期记忆。所有参与者可查看历史；只有生成权限的用户能发送消息、批准生成操作。

消息内容使用结构化 parts：`text`、`execution_summary`、`tool`、`asset`、`task`、`confirmation`、`error`。Markdown 禁止原始 HTML 与危险 URL；图片只引用授权资产，不直接渲染模型提供的任意外链。

Agent 可读当前 Brief、授权素材、版本；可提出 Brief patch、设计方向和生成请求。任何修改 Brief 或付费图片操作先产生持久化 confirmation，用户检查参数和预计额度后批准。页面直接点击“生成”已经明确确认参数时，不额外重复弹窗。

confirmation 绑定项目、发起人、action、参数 hash、Brief revision，以及该 action 涉及的父版本、模型配置、预计费用上限；15 分钟有效。MVP action 为 `apply_brief_patch/create_generation`。只允许发起人批准，批准时重新授权和检查版本。修改 Brief 的批准只保存新未确认 revision；图片批准才创建付费 Task。重复批准返回原结果；拒绝/过期不可执行。参数或权限变化使确认失效。Agent 不能通过更改 payload 绕过确认。

同一会话最多一个活跃 Agent run（包括等待确认）；重复 clientMessageId 返回同一消息/run，不同消息在活跃 run 中返回 409，UI 保留输入。确认生成任务创建后 run 可结束，图片任务独立继续。用户取消 run 不隐式取消已创建图片任务。

Agent 最多 8 次工具调用、120 秒有效执行时间（不含等待用户确认）；单次结构化输出校验失败最多修复 1 次。历史上下文按模型预算裁剪并携带摘要，数据库原始消息不删除。工具每次执行都通过同一业务 Service 授权，不能直接执行 SQL、Shell 或任意 URL 抓取。

### 3.8 导出、审计、配置（FR-10～FR-12）

- **FR-10 导出**：有查看权限的用户可下载单张原图，或选择 1～20 个版本创建 ZIP 任务。ZIP 默认不超过 500 MiB，包含图片和 `manifest.json`（项目、版本、Brief revision、生成时间、模型展示名），不含凭证、内部 Prompt 或客户联系人。导出名称对路径字符做安全处理；PDF 属于 P1。
- **FR-11 审计与费用**：记录登录异常、成员/角色修改、Brief 确认、生成/取消/重试、选图、批准/退回、导出、配置更新；记录操作者、项目、对象、动作、requestId、时间和脱敏变更摘要。审计只追加；管理员可查询，不提供编辑接口。费用区分 estimated/actual/unknown，保留 Provider 原始计价币种，不把未知费用写成零。
- **FR-12 配置**：管理员可查看模型连接健康、启停已登记模型、设置并发与额度；凭证由部署环境注入，不允许从 Web 返回或读取。Prompt 模板以源码文件和版本进入发布，MVP 不做在线 Prompt 编辑器。储存连接变更通过部署配置完成，MVP 不做任意 endpoint 编辑界面。

## 4. Web 页面与交互规范

### 4.1 路由归属

使用 Vue Router 显式路由表和懒加载，不同时引入文件路由插件。路由名称唯一，projectId 和 versionId 等可分享状态进入 URL；面板宽度和临时输入留客户端。

| 路由 | 模块 | 页面职责 |
|---|---|---|
| `/login`、`/account` | auth | 登录、首登/本人修改密码 |
| `/dashboard` | dashboard | 可见项目与任务摘要 |
| `/customers` | customers | 客户管理 |
| `/projects` | projects | 项目列表、创建入口 |
| `/projects/:projectId/overview` | projects | 元信息、成员、状态与审批 |
| `/projects/:projectId/brief` | briefs | 编辑/解析/确认、历史快照 |
| `/projects/:projectId/assets` | assets | 素材上传与筛选；参考图作为类型过滤 |
| `/projects/:projectId/design` | design | 设计工作台；集成生成、版本、会话 |
| `/projects/:projectId/versions` | image-versions | 历史树与比较 |
| `/projects/:projectId/exports` | exports | 导出记录与下载 |
| `/tasks` | tasks | 全部可访问任务 |
| `/settings/users`、`/settings/models`、`/settings/audit` | settings | 管理员功能 |

`/` 重定向 dashboard，项目根路由重定向 overview。未登录去 login，并保留经校验的站内返回路径；无权限和未知资源显示统一不可访问页。P1 的 knowledge 路由在功能交付前不注册占位菜单。

### 4.2 工作台

桌面主界面为左侧 Brief/素材、中间图片、右侧 Agent。顶部显示项目、需求保存/确认状态、当前版本、任务状态和导出入口。设计方向选择、数量/尺寸/模型和费用提示靠近生成按钮。

默认面板宽度：左 280px、右 360px，中间自适应；≥1440px 三栏，1024～1439px 左栏可折叠，768～1023px 侧栏以抽屉打开，低于 768px 以图片/需求/对话标签切换。移动端可查看与执行基础操作，精细编辑留 P2。

所有页面覆盖 loading、empty、error、forbidden、成功状态；工作台增加离线、重连、部分成功、额度不足、未确认 Brief、模型不可用状态。切换项目清空旧项目的临时素材选择、聊天输入缓存和 SSE 订阅，不能短暂显示前一项目数据。

Pinia 只保存用户摘要、主题、面板配置与未保存草稿；服务端数据统一由 TanStack Vue Query 管理。Query key 至少包含会话用户标识、projectId、资源类型和过滤条件；退出清空 Query cache 与 Store。SSE 更新版本号较新的缓存并按资源失效刷新，不能使用整个聊天流覆盖项目状态。

组件使用 `<script setup lang="ts">`。基础 UI 采用 shadcn-vue，AI Elements Vue 按需引入并由本项目会话组件封装；组件库不拥有消息协议。中性色、清晰层级、细边框；所有按钮有可读名称、键盘可达、焦点可见，状态变化提供屏幕阅读器提示。预览默认缩略图，点击才加载原图。

## 5. 技术栈与版本管理

### 5.1 决定采用的技术

| 层 | 基线 | 约束 |
|---|---|---|
| Runtime | Node.js 24 LTS、pnpm workspace、TypeScript strict、ESM | 全仓同一 Node patch/pnpm 版本；M0 锁定，不用 floating latest |
| Web | Vue 3 稳定版、Vite 8、Vue Router 5、Pinia 3 | SPA；显式路由；不引入 Nuxt/SSR |
| 数据与 UI | TanStack Vue Query v5、shadcn-vue、Tailwind CSS 4、AI Elements Vue | 按需复制组件；记录 registry 来源与版本，兼容性不通过则用基础组件实现同协议 |
| API | Fastify 5、TypeBox、Swagger/OpenAPI | 每个路由验证 params/query/body/response；新插件作用域显式使用类型 Provider |
| 前后端契约 | OpenAPI 3.0.3、openapi-typescript、openapi-fetch | 生成类型 + 类型化 fetch，不手写平行 DTO，不误称生成了全部业务 Client |
| 数据库 | PostgreSQL 17、Drizzle ORM/Kit、node-postgres | 迁移 SQL 入库；17 为项目选定基线，不声称最新版本 |
| 异步 | Redis 7.4、BullMQ | Redis 为队列基础设施，PG 为任务业务真源；具体版本和许可证在 M0 记录 |
| 存储 | RustFS、S3 API、AWS SDK for JavaScript v3、sharp | Bucket 私有；兼容性以真实 RustFS 测试为准 |
| Agent | Mastra 嵌入 Worker；一个主 Agent + 受控 Tools | 不另起公开 Mastra 服务；不重复引入第二套认证或任务真源 |
| 模型 | TextProvider/ImageProvider 适配器 | 首个真实 Provider 须同时验证生成和修改；Mock 常驻测试 |
| 可观测 | Pino 结构化日志、任务指标、审计表 | 关联 requestId/taskId/runId，脱敏 |
| 测试 | Vitest、Vue Test Utils、Fastify inject、Playwright | 集成测试使用真实 PG/Redis/RustFS；模型用确定性 Mock |
| 部署 | Docker Compose、Debian slim Node 镜像、Nginx、1Panel HTTPS 入口 | API/Worker 分进程；不叠加 PM2/Kubernetes |

本文保留 Fastify TypeBox 方案。Mastra 工具若要求 Zod，由 `packages/ai` 维护工具输入适配；工具边界校验不能替代业务 Service 校验，也不能复制一整套 HTTP DTO。Vercel AI SDK 只在实际适配需要时作为 `packages/ai` 私有依赖，先验证其与 Mastra 的版本关系。

pgvector 及 Embedding 属于 P1，不是 MVP 数据库启动的前置条件。MVP 可以按客户/风格/项目标签检索历史项目，不假装已提供语义检索。

### 5.2 已核实与尚待核实

截至本文编写日，官方 Node 页面列出 24 和 22 均为 LTS；因此新工程选择 24，而非直接冻结原文旧 patch。[Node 官方版本说明](https://nodejs.org/en/about/previous-releases)

Vite 官方文档给出的 Node 最低要求包括 20.19+、22.12+；具体模板可能更高。本文的 Node 24 选择仍须通过完整依赖安装与构建验证。[Vite 环境要求](https://vite.dev/guide/)

Vue Router 官方有 v5 迁移文档；v5 合并了文件路由能力，但项目可以继续显式声明路由。不能根据历史印象直接把原文 v5 判为不存在。[Vue Router v5](https://router.vuejs.org/guide/migration/v4-to-v5)

shadcn-vue 的 Vite 安装方式包含 `components.json`、Vue TS 配置和 `@tailwindcss/vite`。这些应体现到实际目录，不复制 React 的 JSX 配置。[shadcn-vue Vite 安装](https://www.shadcn-vue.com/docs/installation/vite)

Fastify 支持 Type Provider；当前官方示例使用 `typebox` 包名，实施时必须与锁定的 `@fastify/type-provider-typebox` peer dependencies 对齐，不能混用旧 `@sinclair/typebox` 示例。[Fastify Type Providers](https://fastify.dev/docs/latest/Reference/Type-Providers/)

`openapi-typescript` 负责生成类型，`openapi-fetch` 消费这些类型。[类型生成说明](https://openapi-ts.dev/introduction) · [客户端说明](https://openapi-ts.dev/openapi-fetch/)

AI Elements Vue 与 Mastra 的入口文档可访问，但本文没有运行其集成；原文 Vue 3.5.41、AI Elements Vue 1.5.x、各图片模型的具体 API ID/账号可用性也未逐个验证，不作为硬编码依据。[AI Elements Vue](https://www.ai-elements-vue.com/overview/introduction) · [Mastra 安装资料](https://mastra.ai/reference/manual-install)

### 5.3 M0 必须形成的版本证据

创建 `docs/DEPENDENCY_BASELINE.md`，逐项记录准确包名、版本、engine/peer 约束、许可证、来源和验证日期；提交精确版本 `package.json`、唯一 `pnpm-lock.yaml`、`packageManager` 和 `.node-version`。RustFS/PG/Redis/Node/Nginx 镜像锁定 tag 与 digest。

M0 门禁：依赖可冻结安装、vue-tsc/tsc 通过、Vue 页面可构建、Fastify Schema 可导出 OpenAPI、生成类型可供 Web 使用、最小 Worker 可启动。选定真实 Provider 必须验证模型 ID、区域/账号权限、参考图限制、编辑能力、超时/查询/取消/幂等能力和计费信息；营销名称如 Nano Banana 或原文 GPT-Image-2 只能作为待核实候选标签。

不要求实现所有候选模型，不为无法验证的模型生成猜测性 SDK 调用。Mock 可解除工程开发阻塞，真实模型能力和额度配置未完成则不能通过上线门禁。

## 6. Monorepo 与目录规范（强制）

这些目录是本项目基于技术栈作出的组织决定，不宣称 Vue/Fastify 官方强制使用某一种业务分层。目标是让新增功能有唯一归属，应用可以分别构建，依赖方向可以被静态检查。

### 6.1 仓库根目录

```text
exhibition-ai/
├── apps/
│   ├── web/                         # Vue SPA
│   ├── api/                         # Fastify HTTP/SSE 入口
│   └── worker/                      # BullMQ、Outbox、恢复任务入口
├── packages/
│   ├── contracts/                   # HTTP/Event TypeBox Schema，浏览器安全
│   ├── api-client/                  # OpenAPI 生成类型 + openapi-fetch 封装
│   ├── backend/                     # 仅服务端：应用服务、业务规则、仓储
│   ├── db/                          # Drizzle Schema、迁移、连接
│   └── ai/                          # 模型适配、Mastra、Tools、Prompt
├── infra/
│   ├── compose.dev.yaml
│   ├── compose.prod.yaml
│   ├── docker/                      # web/api/worker Dockerfile
│   ├── nginx/                       # SPA fallback、API/SSE 反向代理
│   └── scripts/                     # 初始化 Bucket、备份/恢复
├── scripts/                         # Node 跨平台开发/契约/依赖检查脚本
├── tests/
│   ├── e2e/                         # Playwright 跨应用用户流程
│   ├── integration/                 # 跨 DB/队列/存储集成用例
│   └── fixtures/                    # 无凭证、无真实客户资料的小样本
├── docs/
│   ├── TECH_STACK_AI_UI.md          # 原始背景
│   ├── REQUIREMENTS_AI_DEVELOPMENT.md
│   ├── DEPENDENCY_BASELINE.md        # M0 生成
│   ├── DEVELOPMENT.md               # M0 起维护的真实启动指南
│   ├── RUNBOOK.md                   # M5 前完成的部署/恢复说明
│   ├── adr/                        # 影响基线的架构决策
│   └── api/openapi.json             # 从 Schema 导出的契约产物
├── .github/workflows/ci.yml         # 采用 GitHub 时落地 CI
├── .env.example                    # 只有说明和非敏感默认值
├── .gitignore
├── .node-version
├── .npmrc                          # save-exact 等项目约定
├── package.json                    # private、packageManager、统一 scripts
├── pnpm-workspace.yaml             # apps/* 与 packages/*
├── pnpm-lock.yaml                  # 全仓唯一锁文件
├── tsconfig.base.json
├── eslint.config.mjs
├── prettier.config.mjs
├── vitest.config.ts
└── playwright.config.ts
```

未实现阶段不预建空模块/空包。数据库、图片、日志、缓存和备份不提交到仓库。每个应用/包有自己的 `package.json`、`tsconfig.json` 和显式 `exports`；仅声明实际使用的依赖，禁止依赖根目录偶然 hoist 的包。

### 6.2 Web 目录

```text
apps/web/
├── index.html                      # Vite HTML 入口，在应用根目录
├── public/                         # favicon 等原样复制的公共静态文件
├── components.json                 # shadcn-vue aliases 与样式位置
├── vite.config.ts                  # Vue + Tailwind Vite 插件、alias、dev proxy
├── tsconfig.json
├── tsconfig.app.json               # Vue/DOM，moduleResolution: Bundler
├── tsconfig.node.json              # Vite 配置等 Node 环境
├── package.json
└── src/
    ├── main.ts                     # createApp 与插件注册
    ├── App.vue                     # 根 RouterView/全局通知
    ├── vite-env.d.ts
    ├── app/
    │   ├── router/                 # routes.ts、guards.ts
    │   ├── providers/              # QueryClient、Pinia 初始化
    │   └── layouts/                # AppLayout、ProjectLayout
    ├── modules/
    │   ├── auth/
    │   ├── dashboard/
    │   ├── customers/
    │   ├── projects/
    │   │   ├── pages/              # ProjectListPage.vue 等路由页
    │   │   ├── components/         # ProjectForm.vue 等业务组件
    │   │   ├── queries/            # key、queryOptions、mutations
    │   │   ├── composables/        # 只用于该业务的组合逻辑
    │   │   ├── project.form.ts     # 表单默认值/适配，非重复 API DTO
    │   │   └── index.ts            # 明确公共出口
    │   ├── briefs/
    │   ├── assets/
    │   ├── design/                 # 工作台编排、DesignWorkspacePage.vue
    │   ├── generations/            # 生成表单/queries/任务操作
    │   ├── image-versions/         # 网格/预览/比较/版本树
    │   ├── conversations/          # AgentPanel 与 message part 展示
    │   ├── tasks/
    │   ├── exports/
    │   └── settings/
    ├── shared/
    │   ├── ui/                    # shadcn-vue 导入的基础组件
    │   ├── ai-elements/           # 按需导入的 AI 展示组件
    │   ├── components/           # PageHeader、EmptyState 等跨模块组件
    │   ├── composables/          # useMediaQuery 等无业务归属能力
    │   ├── lib/                  # cn、日期/数值格式化
    │   ├── api/                  # 配置 api-client，401/错误处理
    │   ├── realtime/             # SSE 连接、事件解码、重连
    │   └── styles/               # main.css、tokens.css
    └── stores/                   # session-summary、app-ui
```

工作台临时 Store 放在 `modules/design`，不把所有业务 Store 放全局。只有出现实际需要才添加模块子目录；不得为一个函数创建五层空目录。测试与组件/函数邻近放 `*.test.ts`，跨应用测试放根 tests。

`@` 仅映射当前 Web `src`，Vite、TS、components.json 三者一致。组件文件 PascalCase，普通 TS 文件 kebab-case，composable 函数名 `useXxx`。不再新建平行的 `src/views`、`src/services`、`src/components/business`、`src/utils`、`src/types` 作为杂物目录。

页面只做装配；查询/Mutation 在所属模块 queries 中调用统一 Client。复杂响应转换才增加模块 `api/`；简单 CRUD 不强制多一层转发。`design` 可以导入 briefs/assets/generations/image-versions/conversations 的公共出口，其他模块不得反向依赖 design。其余跨模块复用必须经 index 或上层页面编排，禁止深层路径导入和循环依赖。

### 6.3 API、Worker 与服务端包

```text
apps/api/src/
├── server.ts                       # listen、信号、graceful shutdown
├── app.ts                          # buildApp(dependencies)，测试不 listen
├── bootstrap.ts                    # 创建 DB/存储/Session/Service 依赖
├── plugins/
│   ├── auth.ts                     # Session、CSRF、请求 ActorContext
│   ├── security.ts                 # 限流、header、可信代理
│   ├── openapi.ts
│   ├── error-handler.ts
│   └── request-context.ts
├── modules/
│   ├── projects/
│   │   ├── project.routes.ts       # URL/Schema/授权入口/HTTP 状态映射
│   │   └── index.ts                # 注册 Fastify 插件
│   └── ...                         # 与业务模块同名，按实际实现创建
├── realtime/                       # Project SSE 注册与补发
└── health/                         # live/ready

apps/worker/src/
├── main.ts                         # 启动、并发、优雅退出
├── bootstrap.ts                    # 装配相同 backend 服务及 AI runtime
├── processors/
│   ├── agent-run.processor.ts
│   ├── image-generation.processor.ts
│   ├── asset-validation.processor.ts
│   └── export.processor.ts
└── schedulers/
    ├── outbox-dispatcher.ts
    ├── task-reconciler.ts          # 超时/中断/Provider 结果对账
    └── storage-cleanup.ts

packages/backend/src/
├── modules/
│   ├── projects/
│   │   ├── project.service.ts      # 用例、权限规则、事务边界
│   │   ├── project.repository.ts   # Drizzle 查询，可接收事务连接
│   │   ├── project.policy.ts       # 可复用授权判断
│   │   └── index.ts
│   ├── auth/ users/ customers/ briefs/ assets/
│   ├── generations/ image-versions/ conversations/
│   └── tasks/ exports/ audit/ settings/
├── ports/                          # ImageProvider、StorageProvider 等外部能力接口
├── infrastructure/
│   ├── storage/                    # S3 实现、签名 URL、流式读写
│   ├── queue/                      # 队列名、payload、producer
│   ├── config/                     # 服务端环境校验
│   └── logging/                    # Pino 与脱敏
└── shared/                         # ActorContext、业务错误、事务辅助

packages/db/
├── src/schema/                     # 按领域分表，含约束/索引/relations
├── src/client.ts
├── src/index.ts
├── migrations/                     # Drizzle Kit 生成并审阅的 SQL
├── drizzle.config.ts
└── scripts/                        # migrate、dev seed、受控 bootstrap-user

packages/contracts/src/
├── common/                         # 分页、错误、ID、时间
├── projects/ briefs/ assets/ ...    # 请求和响应 Schema
├── events/                         # SSE envelope 与 discriminated union
└── index.ts

packages/api-client/src/
├── generated/schema.d.ts           # 只由 OpenAPI 生成
├── client.ts                       # createClient<paths> 与公共配置
└── index.ts

packages/ai/src/
├── providers/                      # mock、首个真实 Text/Image 适配实现
├── mastra/
│   ├── agents/booth-agent.ts
│   ├── tools/                      # 调用注入的 backend 用例
│   ├── workflows/                  # 需求分析/方向提案
│   └── index.ts                    # runtime factory；不启动公开服务器
├── prompts/                        # 有版本标识的模板/元信息
└── index.ts
```

树中 `auth/ users/ ...` 表示各自独立目录，不是带空格的单一目录。`backend` 是内部模块化单体，不是微服务框架；Repository 默认采用 Drizzle 具体实现，仅外部能力和实际测试替身需要接口。

### 6.4 依赖方向与构建

```text
web → api-client → generated API types
web → contracts（仅确有需要的事件校验/纯 Schema）
api → backend → db
worker → backend → db
worker → ai → backend 的公开 ports / 用例
api/backend → contracts
```

`backend` 禁止导入 `ai`，由 worker bootstrap 注入 Provider/Agent runner，避免循环。`db` 不依赖业务应用；contracts 不导入 db、backend、ai，也不读取环境变量。Web 永远不导入服务端包。队列 payload 属于 backend，不伪装成公开 HTTP 契约。

使用 ESLint `no-restricted-imports` 和依赖图检查脚本阻止跨 app import、服务端进入浏览器、深层私有 import 和循环依赖。不得用 TS path alias 跨到另一个包的 src 绕过 exports。

服务端采用 `module/moduleResolution: NodeNext`，编译为 ESM JS；相对 import 按 Node ESM 输出使用 `.js` 路径。Web 使用 Bundler 解析，不能全仓强套一份 TS 模块配置。开发使用 tsx，生产执行编译后的 `dist/*.js`，不依赖 Node 原生 TS 支持。共享包先按拓扑构建；pnpm 使用 `workspace:*` 引用。

### 6.5 新增功能的固定落点

以“重试失败输出”为例：contracts 定义请求/响应 → backend generations 实现授权、费用、重试与 Outbox → API 注册路由 → Worker 消费 → 导出 OpenAPI/重新生成类型 → Web generations 添加 Mutation 与按钮 → 集成和 E2E 验证。不要在 Web 直接操作队列，不在 processor 重写一套授权规则。

## 7. 数据模型与数据库约束

### 7.1 通用约定

内部业务 ID 统一 UUID；API 为字符串。时间存 PostgreSQL `timestamptz`，API 用 UTC ISO 8601，Web 按 Asia/Shanghai 展示；日期字段使用 `date`。数据库 snake_case，HTTP camelCase，由边界映射。

业务表默认 `id, created_at, updated_at` 非空；可修改聚合增加整数 `revision`。枚举值以 Schema 与 DB CHECK/enum 保持一致；状态变更由 Service 处理。金额采用 bigint 最小单位并带币种，API 序列化为十进制字符串，禁止 JS 浮点金额运算；Brief 表单的小额整数必须转换为同一线格式。

JSONB 仅用于已校验快照、模型参数和 message parts，不替代资产/任务/版本的关系外键。核心历史表使用 RESTRICT，不使用项目删除级联抹掉生成记录。

### 7.2 MVP 最小表清单

下表列业务关键列，实施迁移须同时落实本节关系与约束；并非可以直接复制执行的完整 DDL。

| 表 | 关键列 | 关系/唯一约束 |
|---|---|---|
| users | email、display_name、password_hash、role、status、must_change_password、revision | 规范化 email 唯一 |
| sessions | token_hash、user_id、last_seen_at、expires_at、absolute_expires_at、revoked_at | token_hash 唯一；只保存散列 |
| customers | name、contact_name、contact_phone/email、created_by、status、revision | 创建者 FK；联系人属于敏感业务数据 |
| projects | customer_id、owner_id、name、exhibition 元信息、status、archived_from_status、current_brief_revision_id、selected_version_id、next_version_sequence、next_event_sequence、revision | 负责人/客户 FK；选中版本必须同项目；序号分配锁定项目行 |
| project_members | project_id、user_id、added_by | `(project_id,user_id)` 唯一 |
| brief_revisions | project_id、number、content、created_by、confirmed_by、confirmed_at | `(project_id,number)` 唯一；content 不可变，确认信息仅写一次 |
| design_directions | project_id、brief_revision_id、source_task_id、title、content、created_by | 每条是不可变候选；任务引用不可改 |
| upload_sessions | project_id、user_id、temp_key、expected_size/type、expires_at、asset_id、status | temp_key 唯一；一个会话对应一个资产 |
| assets | project_id、kind、status、bucket、object_key、original_filename、mime_type、size_bytes、width、height、sha256、source_asset_id、hidden_at、created_by | `(bucket,object_key)` 唯一；source_asset_id 关联缩略图等派生物 |
| tasks | project_id、kind、subtype、status、stage、progress、revision、input_snapshot、result_snapshot、retry_of_task_id、retry_output_mapping、requested_by、cancel_requested_at、started_at、finished_at、error_code、error_detail | 业务任务唯一真源；所有状态变化 revision 增加 |
| task_inputs | task_id、asset_id、role、ordinal | `(task_id,asset_id,role)` 唯一；同项目且 ready |
| generation_batches | task_id、brief_revision_id、direction_id、parent_version_id、count、model_config_id | task_id 唯一；生成特有字段，不再重复一张 generation_tasks 状态表 |
| task_outputs | task_id、ordinal、state、asset_id、version_id、active_attempt_id | `(task_id,ordinal)` 唯一；单次生成每张一个输出单元 |
| task_attempts | task_id、output_ordinal、attempt_no、provider_request_id、status、lease_owner、lease_until、fencing_token、error_code、started_at、finished_at | `(task_id,output_ordinal,attempt_no)` 唯一 |
| image_versions | project_id、asset_id、parent_version_id、task_id、output_ordinal、sequence、brief_revision_id、created_by | asset_id 唯一；`(project_id,sequence)` 与 `(task_id,output_ordinal)` 唯一 |
| project_reviews | project_id、version_id、brief_revision_id、action、comment、actor_id | 只追加批准/退回/重开记录 |
| conversations | project_id、title、active_run_id | MVP project_id 唯一 |
| messages | conversation_id、role、parts、status、client_message_id、created_by | 同会话非空 client_message_id 唯一；流式内容按批次持久化 |
| agent_runs | conversation_id、task_id、confirmation_id、input_message_id、summary、tool_call_count、active_elapsed_ms | task_id 唯一；执行状态仅从 tasks 读取，不再复制 status |
| confirmations | run_id、project_id、requested_by、action、payload、payload_hash、expires_at、status、result_task_id、result_brief_revision_id | 状态 CAS 单次批准；按 action 恰好一个结果引用，结果复用 |
| tool_executions | run_id、call_id、tool_name、status、input_summary、output_summary、task_id | `(run_id,call_id)` 唯一 |
| prompt_versions | name、version、content_hash、content、created_by | `(name,version)` 唯一；源码发布同步，不覆盖历史 |
| model_configs | provider_key、model_id、display_name、capabilities、pricing_snapshot、enabled、revision | 凭证仅存环境变量引用名，不存 secret 值 |
| usage_ledger | task_id、attempt_id、user_id、provider、model、amount_minor、currency、period_date、status、reservation_id、record_kind | 预留/结算/释放操作有唯一业务键，禁止重复扣费；结算/释放继承预留日期 |
| quota_limits | scope_type、scope_id、period、limit_minor、currency、revision | `(scope_type,scope_id,period,currency)` 唯一；系统 scope_id 使用固定非空值；事务检查 |
| export_items | task_id、version_id、ordinal | `(task_id,version_id)` 唯一；结果 ZIP asset 存 task_outputs |
| audit_logs | actor_id、project_id、action、resource_type/id、request_id、change_summary | 只追加；不含 secret/完整 Prompt |
| idempotency_keys | actor_id、operation、key、request_hash、resource_id、response_status、expires_at | `(actor_id,operation,key)` 唯一 |
| outbox_events | event_type、aggregate_id、payload、available_at、attempts、published_at | 事务内写；投递失败保留 |
| project_events | project_id、sequence、event_type、resource_id、resource_revision、payload | `(project_id,sequence)` 唯一；用于 SSE 补发 |

其余状态也必须在 contracts/DB 中固定，不能由不同模块自创近义词：

| 对象 | 合法状态/转换 | 终态与重试 |
|---|---|---|
| asset | `pending → validating → ready/rejected` | ready 原图不可覆盖；隐藏另用 hidden_at；失败重新上传新资产 |
| upload session | `initiated → validating → completed/failed`，`initiated → expired` | completed/failed/expired 为终态；重复 complete 读取原结果 |
| task output | `pending → running → succeeded/failed/reconciling`，`pending/running/reconciling → cancelled`，`reconciling → succeeded/failed` | 成功/失败/取消输出不可被迟到结果覆盖；用户重试创建新 Task |
| task attempt | `prepared → dispatching → running → succeeded/failed/unknown`；prepared 可 cancelled；dispatching/running 可 unknown | unknown 经对账转 succeeded/failed/cancelled；禁止当成未执行自动重发 |
| confirmation | `pending → approved/rejected/expired` | 均为终态；approved 与对应结果引用在同一事务写入 |
| message | `pending → streaming → completed/interrupted/failed` | 已持久化内容保留；失败重试创建新 run，不篡改原消息 |

非图片任务的执行 attempt 使用约定 ordinal=0；图片每张用 0～count-1。纯文本结果用 result_snapshot，导出用 ordinal=0 的文件输出。原始任务与重试任务的 ordinal 映射保存到 tasks.retry_output_mapping，并由 Schema 验证及同项目外键关联。

### 7.3 必须由约束和事务保证的关系

- projects 的当前 Brief、选中版本与 generation_batches 的 Brief/父版本必须同项目。对应表增加 `(project_id,id)` 唯一键，通过复合 FK 或不可绕过的等效数据库约束实施，不能只信任前端。
- image_versions 的父版本必须同项目且已存在；创建后 parent 不允许更新，因此不能形成环。sequence 通过项目行锁下的计数器/事务分配，禁止无锁 `MAX(sequence)+1`。
- 输入资产、方向、会话和导出项都验证同项目。提交时要求输入 kind 合法、ready 且未隐藏；Worker 再检查历史引用仍可读、kind/ready 和任务权限，不因提交后的隐藏操作拒绝已接受输入。新根图的方向必须来自该任务使用的 Brief revision。
- 选图、审批、Brief 更新使用项目 revision 的条件更新；受影响行数 0 返回 409。项目确认的 Brief 更新后旧确认不得用于新生成。
- Worker 结果落库事务同时写资产元数据、版本、output、任务状态/事件、费用结算及后续 Outbox。事务失败时对象文件不算业务成功，交由恢复器认领或孤儿清理。
- task_inputs 引用的资产即使用户隐藏也仍可供已接受任务读取；新的生成不得选择已隐藏输入。取消/权限撤销由任务策略独立处理。

索引至少覆盖：成员 user_id/project_id；项目 status/updated_at/id；资产 project_id/kind/created_at；版本 project_id/sequence 与 parent_version_id；任务 project_id/status/created_at 与状态/lease；消息 conversation_id/created_at/id；Outbox 未投递 available_at；事件 project_id/sequence。查询不得默认扫描全表加载到内存过滤。

## 8. 异步任务、一致性与费用

### 8.1 状态及转换

```text
pending → queued → running → succeeded
                      ├──→ partially_succeeded
                      ├──→ failed
                      ├──→ awaiting_confirmation → running
                      ├──→ reconciling → running / 终态
                      └──→ cancel_requested → cancelled / reconciling
pending / queued / awaiting_confirmation → cancelled
```

终态为 `succeeded/partially_succeeded/failed/cancelled`，不能被迟到的事件改回 running。`awaiting_confirmation` 仅适用于 Agent 任务；只有图片任务有 `partially_succeeded`。无法判断 Provider 是否已执行时使用 `reconciling`，不能直接认定失败并重发。

取消与完成使用数据库 CAS：完成先提交则取消返回当前成功终态；取消先提交则迟到结果不作为新设计版本发布，仍记录费用和回执，并清理未采用文件。取消前已提交的成功输出保留可查看，任务最终 cancelled 不抹除它们。

用户重试创建新的 Task，带 `retryOfTaskId` 和失败 ordinal 映射，旧 Task 保持终态。新任务仅处理失败输出；已有成功图片和费用不复制。供应商结果未知时禁止普通重试，管理员先完成对账或明确选择“可能重复计费仍重新发起”，并记录审计。

### 8.2 创建与执行顺序

1. API 校验 Session/CSRF、项目权限和状态，随后按 kind 校验前置条件。设计方向/图片生成需要已确认 Brief 与模型能力；brief_parse 可读取未确认草稿；asset_validation/export 不要求模型或 Brief 确认。Agent 的具体工具在执行前校验自身前置条件。所有付费类型检查额度；队列容量按对应任务类型检查。
2. 处理 Idempotency-Key，在同一 PG 事务写 Task、输入快照、outputs、费用预留、项目事件与 Outbox；返回 `202 + taskId`。不能在事务内等待模型或对象存储网络请求。
3. Outbox dispatcher 扫描待投递事件，使用稳定 jobId（task/output/attempt 的安全组合，不使用冒号）写 BullMQ，成功后标记投递。进程在投递后崩溃可重复投递，由幂等消费者兜底。
4. Worker 从数据库读取可信快照，用条件更新领取输出执行权，并再次检查发起用户/项目权限与任务状态。payload 只含 taskId/output ordinal/schemaVersion，不含凭证、图片、未经验证的用户参数。
5. 调用 Provider 前创建 attempt，绑定/分摊创建 Task 时已有的预留，不能重复预留同一笔额度；新增可能计费的 attempt 若超过原预留上界，先原子补足额度，否则停止执行。Provider 支持幂等键时传稳定键。结果流式存对象，校验格式/解码/数量后事务落库；只有图片生成结果创建 image_version，其他类型按自身结果 Schema 落库并写项目事件。
6. 独立后处理任务生成缩略图。主结果已安全保存即可发布版本；缩略图失败不重新调用模型，可单独补处理。
7. 完成所有输出后聚合 Task；REST/事件均从 PG 提供业务结果，BullMQ 清理已完成 job 不影响历史。

BullMQ 重试要求任务幂等；框架本身不能保证第三方付费调用恰好执行一次。[BullMQ 幂等任务说明](https://docs.bullmq.io/patterns/idempotent-jobs)

### 8.3 重试、租约与异常恢复

MVP 默认调度间隔 5 秒、恢复扫描 30 秒、执行租约 90 秒、每 20 秒续约；写结果必须携带当前 fencing token。API/Worker 优雅退出先停止领取，再等待最多 30 秒；超时由恢复器接管，不能仅依赖进程内标志。

单输出图片调用默认超时 180 秒，以 Provider 实际能力配置覆盖。超时值代表进入恢复判定，不证明 Provider 没执行。限流及明确未受理的临时错误最多重试 3 次，遵守 Retry-After，指数退避并带抖动；认证错误、参数错误、内容拒绝不自动重试。

| 故障点 | 必须行为 |
|---|---|
| PG 提交成功、Redis 不可用 | Task 保持 pending，Outbox 稍后重投；UI 显示等待调度 |
| Redis 丢失任务/Worker 宕机 | 根据 PG 非终态任务与租约重建安全可重放的 job |
| Provider 已受理但响应丢失 | 进入 reconciling，优先按 requestId 查询；不支持查询则等待人工对账 |
| 对账长期无结果 | 15 分钟触发管理员告警；24 小时仍未知则保留 reconciling 和费用预留，不自动免费重跑 |
| 文件已上传但 DB 未提交 | 用稳定输出 object key/attempt 恢复关联；未被引用对象至少 24 小时后清理 |
| 同一输出重复回调/重复投递 | 唯一键 + attempt token 去重，不产生双版本/双结算 |
| 部分成功 | 保留成功图，失败 output 显示原因；允许仅重试失败部分 |
| 发起人权限被撤销 | 未调用模型则取消；已调用的结果保留项目内可审计，撤权用户不能查看；后续工具调用拒绝 |

跨实例并发上限使用 Redis 原子限流与 PG 领取规则共同约束，不用单进程计数假装系统全局限制。队列满返回 429 和 Retry-After，不在浏览器无限重试创建任务。

### 8.4 费用策略

AI 调用额度与客户展台预算独立。管理员在启用真实 Provider 前配置系统每日额度、用户每日额度、单任务最大费用，支持项目累计额度；无价格估算或保守上界时禁止自动付费执行。

额度检查和预留需事务原子完成，两个并发请求不能共同突破限额。按 Provider 计价币种核算；不同币种不直接相加，MVP 不自动换汇。最终已知实际费用用于结算，未受理/未执行释放预留；未知费用保留预留并标记 unknown，等待人工对账。文本解析/Agent 调用同样纳入用量记录，不能只限制图片。

额度按 Asia/Shanghai 自然日归集，跨日执行仍结算到预留所属日期。费用配置变化不追改历史快照。管理员确认对账须填写依据，审计保留调整前后值；UI 不把估算标为账单。

## 9. HTTP 与事件契约

### 9.1 通用规则

前缀固定 `/api/v1`；健康接口使用 `/health/live`、`/health/ready`。所有路由有稳定 `operationId`、请求和响应 Schema、状态码、权限说明及契约测试。TypeBox Schema 在 contracts 中维护，由 Fastify 注册后导出 OpenAPI；OpenAPI 和 generated 类型禁止手工改字段。

成功实体：`{ "data": {...} }`；列表：`{ "data": [...], "page": { "nextCursor": null, "hasMore": false } }`。异步接受：`{ "data": { "taskId": "UUID", "status": "pending" } }`。删除/退出成功用 204，不附 body。

```json
{
  "error": {
    "code": "BRIEF_NOT_CONFIRMED",
    "message": "请先确认当前需求版本",
    "details": [{ "field": "briefRevisionId", "reason": "not_confirmed" }],
    "requestId": "opaque-request-id"
  }
}
```

Schema 错误 400、未登录 401、可见但禁止操作 403、不可访问资源 404、幂等/版本/状态冲突 409、文件过大 413、不支持媒体 415、业务前置条件不满足 422、额度/队列/限流 429、依赖暂不可用 503。错误码使用固定枚举，不向用户返回 SQL、堆栈、Provider 原始凭证或内部 URL。

创建付费/异步任务、发送消息、创建导出、批准 confirmation 必须带 `Idempotency-Key`（客户端 UUID）。同 actor/operation/key + 同参数返回同资源；相同 key 不同请求 hash 返回 409。键默认保留 7 天；客户端重试复用原键。HTTP Mutation 不做无条件自动重试；超过键保留期须显式重新提交。

PUT/PATCH 与状态变更传 `expectedRevision`；新 Brief 传当前项目 revision。服务端比较并递增 revision，返回最新 revision；事件同时携带资源 revision。分页 cursor 是不透明值，解码失败返回 400，排序固定并含 id 消除相同时间歧义。

### 9.2 MVP 接口清单

以下路径省略 `/api/v1`，参数都必须 UUID 校验；表内 `:id` 对应所在资源，不跨类型复用。

| 模块 | 方法与路径 | 输入/结果要点 |
|---|---|---|
| auth | `POST /auth/login` | email/password → 用户摘要、Cookie；不返回 Token |
| auth | `GET /auth/me`、`GET /auth/csrf` | 当前用户/角色；Session 绑定 CSRF Token |
| auth | `POST /auth/logout`、`PUT /auth/password` | 注销；currentPassword/newPassword，成功撤销其他 Session |
| users | `GET /users`、`PATCH /users/:id` | admin 分页查询、status/role/expectedRevision |
| users | `GET /users/options` | 项目负责人可获取启用用户的 id/name/role，限流分页、不返回联系方式 |
| customers | `GET/POST /customers`、`GET/PATCH /customers/:id` | 范围过滤、创建、修改；停用用 status |
| dashboard | `GET /dashboard` | 授权范围内摘要 |
| projects | `GET/POST /projects`、`GET/PATCH /projects/:id` | 列表/元信息；PATCH 不接受直接写 status/selectedVersionId |
| projects | `GET/POST /projects/:id/members`、`DELETE /projects/:id/members/:userId` | 成员管理；移除带 expectedRevision |
| projects | `POST /projects/:id/transfer-owner` | userId/expectedRevision |
| projects | `POST /projects/:id/transitions` | action=submit_review/approve/request_changes/reopen/archive/restore，comment/expectedRevision |
| briefs | `GET /projects/:id/brief`、`PUT /projects/:id/brief` | 当前快照；保存 content/expectedRevision → 新 revision |
| briefs | `GET /projects/:id/brief-revisions`、`GET /projects/:id/brief-revisions/:revisionId` | 分页历史与不可变详情 |
| briefs | `POST /projects/:id/brief/parse` | text/基础 revision → 202 Task，结果是 patch 候选 |
| briefs | `POST /projects/:id/brief/confirm` | briefRevisionId/expectedRevision → 已确认快照 |
| assets | `POST /projects/:id/uploads` | kind/name/size/mime → uploadId/url/requiredHeaders/expiresAt |
| assets | `POST /projects/:id/uploads/:uploadId/complete` | 服务端检查对象 → assetId/validationTaskId，重复调用复用 |
| assets | `GET /projects/:id/assets`、`GET /assets/:id` | 元数据和受控预览信息，不含永久公网 URL |
| assets | `DELETE /assets/:id` | 隐藏，幂等；不物理删除 |
| assets | `POST /assets/:id/download-url` | 授权后返回短期签名、有效期；原图或 thumbnail 变体 |
| directions | `POST /projects/:id/design-directions`、`GET /projects/:id/design-directions` | briefRevisionId/inputAssetIds → 202 Task；GET 读候选 |
| generations | `POST /projects/:id/generations`、`GET /projects/:id/generations` | 创建/列出 kind=image_generation 的 Task |
| versions | `GET /projects/:id/image-versions`、`GET /image-versions/:id` | 分页/parentVersionId 筛选，版本元信息 |
| versions | `PUT /projects/:id/selected-version` | versionId/expectedRevision，空值用于撤销选择 |
| tasks | `GET /tasks`、`GET /tasks/:id` | 授权列表与详情，含 outputs、错误、允许操作 |
| tasks | `POST /tasks/:id/cancel`、`POST /tasks/:id/retry` | 取消返回当前状态；重试返回新 taskId |
| tasks | `POST /tasks/:id/reconcile` | admin 提交查询/人工结论及依据；不能强写 succeeded 伪造资产 |
| conversations | `GET /projects/:id/conversation` | 默认会话在建项目事务中创建，GET 无副作用 |
| conversations | `GET/POST /conversations/:id/messages` | 游标历史；text/clientMessageId/assetIds → 202 runId/taskId/messageId |
| confirmations | `POST /confirmations/:id/approve`、`POST /confirmations/:id/reject` | payloadHash，批准按 action 返回 taskId 或 briefRevisionId；重新授权 |
| exports | `POST/GET /projects/:id/exports` | versionIds/format=zip → Task；GET 历史 |
| events | `GET /projects/:id/events` | 单项目 SSE，详见下节 |
| settings | `GET /models` | 所有登录用户读取已启用模型的脱敏能力和可用性 |
| settings | `GET/PATCH /settings/models/:id` | admin 配置 enabled/额度相关参数/revision；不能提交 secret/任意 URL |
| settings | `GET/PUT /settings/quotas`、`GET /settings/usage` | admin 配置额度、查询估算与结算 |
| audit | `GET /audit-logs` | admin 按项目/操作者/时间/动作过滤 |

取消 Agent run 通过其 taskId 的取消接口。`brief_parse/design_direction/agent_run/image_generation/asset_validation/export` 是 MVP task kind；图片缩略图属于 `asset_validation` 的派生后处理任务，可单独标记 subtype。纯文本任务的结构化结果存受 Schema 校验的 `result_snapshot`，文件型结果存 outputs；不得把大图片 Base64 放 result_snapshot。

TextProvider 返回受 Schema 校验的 Brief patch/设计方向或可公开文本事件；ImageProvider 至少提供能力查询、generate、edit，并声明是否支持 query/cancel/idempotency。统一输入使用服务端解析后的资产流或受控 URL，统一结果包含 requestId、有效输出、用量和计费状态；错误区分 invalid_input/auth/rejected/rate_limited/not_accepted/unknown_after_accept。只有声明支持的 query/cancel 才可调用，不给所有模型伪造同一供应商参数。MVP 适配器按单输出请求调度，批量由任务层 fan-out，避免供应商返回图数语义不同。

生成请求示例（字段值是示意，ID 必须替换为真实 UUID）：

```json
{
  "mode": "generate",
  "briefRevisionId": "<confirmed-brief-uuid>",
  "directionId": "<direction-uuid>",
  "parentVersionId": null,
  "inputAssetIds": ["<ready-asset-uuid>"],
  "instruction": "现代简洁风格，突出入口与品牌主色",
  "modelConfigId": "<enabled-model-config-uuid>",
  "parameters": { "count": 3, "sizePreset": "<supported-preset>" },
  "expectedProjectRevision": 6
}
```

生成新方向的根图必须传 directionId；修改图片必须传 parentVersionId，directionId 可空，并填写 instruction。两种模式显式使用 `mode=generate/edit`，Schema 采用联合类型限制字段。旧 Brief 修改确认另传 `acknowledgeBriefChange=true`，服务端保存差异摘要；不能由 UI 无条件默认设置。

### 9.3 SSE

每个打开的项目仅建立一条 SSE，复用传递任务、消息、确认、资产就绪、版本变更事件；全局任务中心默认每 5 秒 Query 轮询，页面后台降频。保留 HTTP REST 作为权威恢复入口，不创建四套相似 stream URL。

```text
id: 128
event: task.updated
data: {"schemaVersion":1,"projectId":"...","resourceId":"...","resourceRevision":4,"occurredAt":"2026-09-14T03:00:00Z","payload":{"status":"running","stage":"generating","progress":null}}

```

事件类型固定为 `task.updated/message.delta/message.completed/confirmation.created/asset.ready/version.created/project.updated`。事件有项目内单调 sequence；分配 sequence 与状态提交必须按项目串行锁定，避免先提交大序号再提交小序号造成补发遗漏。资源 revision 用于丢弃迟到状态。

服务端同一事务保存关键状态事件。文字流按约 250ms/合理字符量批量持久化，delta 带 messageId 与 offset；重连以已保存消息快照和 offset 恢复，客户端不能盲目追加重放文本。只保证已持久化部分可恢复，进程崩溃后未知尾部标记 interrupted。

浏览器用同源 EventSource 和 Cookie；初连可传 `after` cursor，自动重连使用 `Last-Event-ID`（后者优先）。游标不能跨项目复用。保留最近 7 天事件；过旧 cursor 返回 `stream.reset` 控制事件，客户端重新 GET 项目/活跃任务/消息快照，以响应中的 latestEventSequence 重连。

SSE 每 15 秒发送注释心跳；客户端指数退避 1～30 秒，连接断开只表示离线，不表示任务失败。服务端每 30 秒复核 Session 与项目权限，到期关闭；客户端收到不可用信号通过 `/auth/me` 判断是否需登录。所有连接清理订阅，限制每用户最多 5 条。

MVP 可由 API 每秒批量查询所连接项目的新 PG 事件再推送，无需 Redis Pub/Sub 成为第二持久化事件源。代理关闭流式接口缓冲和压缩；通过真实 HTTPS 反代测试断线、重连与终态补发。

## 10. 对象存储与文件生命周期

私有 Bucket 默认 `exhibition-ai`，不同环境采用不同 Bucket/凭证。稳定对象键以 ID 组织，不以用户文件名或可变版本编号命名。

```text
projects/{projectId}/uploads/{uploadId}/original
projects/{projectId}/assets/{assetId}/original.{ext}
projects/{projectId}/assets/{assetId}/thumbnail.webp
projects/{projectId}/outputs/{taskId}/{ordinal}/{attemptId}.{ext}
projects/{projectId}/exports/{taskId}/proposal.zip
```

数据库保存 bucket/object_key/sha256 等元信息，不保存宿主机路径或永久签名 URL。生成原始图保持 Provider 返回的有效格式，不以改扩展名假装 WebP；缩略图最大长边 512px，用 sharp 转 WebP。

StorageProvider 至少提供 `putStream/getStream/head/delete/presignPut/presignGet`，参数含 bucket/key/contentType/受限大小与有效期。大文件用流，不能以统一 Buffer 接口要求全量进内存。一个 S3 实现通过 endpoint 配置适配 RustFS；未有实际差异前不复制四份同构 StorageProvider。

直传临时对象和业务正式对象必须分离：用户短期 PUT 签名只允许写自己的 temp key；Worker 解码验证读取到的字节、计算 sha256，再将已验证内容写入未暴露 PUT 签名的正式 key。验证后的 ready 资产永远不指向可再次覆盖的 temp key。临时 URL 到期前重传不得改变历史 ready 资产。

签名上传 10 分钟有效；未 complete 的会话 1 小时后过期，临时对象 24 小时清理。下载签名最长 5 分钟。下载 URL 只在有权限请求时生成，过期可重新获取；不写进聊天历史和数据库长期字段。隐藏图片默认保留，物理清理由管理员按保留策略单独执行，且必须无引用、无活跃任务。

区分 `S3_INTERNAL_ENDPOINT`（容器访问）与 `S3_PUBLIC_ENDPOINT`（浏览器签名）。生产示例使用 `https://objects.example.com` 反代 S3 API，RustFS console 仅管理网络可见；S3 endpoint 本身可达不等于 Bucket 公开读写。签名时即使用最终外部 Host/Path，不事后替换已签名 URL。

对象入口保留 Host、URI、query 和必要签名 header；配置 CORS 仅允许 Web 域名、PUT/GET/HEAD 和实际签名请求头，并暴露客户端实际需要的响应头。开发 localhost Origin 单独配置，不带进生产。反代与校验同时限制文件大小；签名 PUT 本身不视为已强制验证声明的大小/类型。

对象访问日志隐藏签名 query。Provider 返回 URL 的下载仅接受配置允许的 HTTPS 主机，校验 DNS/IP、禁止私网/回环/链路本地目标，重定向每跳复核，设大小和超时上限；优先采用 SDK 返回字节。用户不能让服务器任意抓取 URL。

原文 RustFS 文档入口可访问，但没有在本次工作运行真实实例；S3 PUT/GET/HEAD、签名、CORS、流式上传和重启恢复均列入 M1 集成门禁。[RustFS 文档入口](https://docs.rustfs.com/)

## 11. 部署、运行配置与可观测性

### 11.1 进程与网络

生产 Compose 至少含 `web/api/worker/postgres/redis/rustfs` 六个服务；一次性 `migrate` 与 `storage-init` 作为部署 job，不由每个 API/Worker 启动时争抢执行。1Panel 管域名、TLS、Compose 与运维；应用配置和发布流程仍由仓库描述。

```text
浏览器 → HTTPS ai.example.com → Nginx/Web
                              └─ /api/* → Fastify API
浏览器 → HTTPS objects.example.com → RustFS S3 API（仅签名读写）
API/Worker → PostgreSQL、Redis、RustFS（私有 Docker 网络）
Worker → 已配置的外部模型 API
```

SPA 对非 API 的页面路径回退 index.html；API 404 必须保持 JSON，不能被 SPA fallback 吞掉。生产仅 Web 与对象 HTTPS 入口对外；DB、Redis、RustFS 控制台与 API 原始端口不暴露公网。

Node 镜像选锁定 patch 的 bookworm-slim，Web 多阶段构建后使用锁定 Nginx 镜像。非 root 运行 API/Worker，镜像只包含必要生产产物；API 和 Worker 独立健康检查、扩容、退出。CPU/内存/并发限制须显式配置，禁止一个大图解码耗尽整个宿主机。

初始容量验证环境建议 4 vCPU、8 GiB RAM、至少 100 GiB 可用 SSD，无本地 GPU；该配置是测试起点，不是未经压测的容量保证。接入 ComfyUI 后另算 GPU、显存和磁盘预算。

### 11.2 环境变量契约

这些键由本项目自行定义，不宣称是框架自带配置。启动时使用 Schema 校验；缺少生产必填项须清楚报错退出，禁止退回开发密码或 Mock。

| 类别 | 变量 | 规则 |
|---|---|---|
| 运行 | `APP_ENV`、`PORT`、`WEB_ORIGIN`、`LOG_LEVEL` | 环境 dev/test/prod；服务端端口默认 3000 |
| DB/Queue | `DATABASE_URL`、`REDIS_URL` | 仅服务端，日志脱敏 |
| 存储 | `S3_INTERNAL_ENDPOINT`、`S3_PUBLIC_ENDPOINT`、`S3_REGION`、`S3_BUCKET`、`S3_FORCE_PATH_STYLE` | 是否 path style 由 RustFS 集成验证确定 |
| 凭证 | `S3_ACCESS_KEY_ID`、`S3_SECRET_ACCESS_KEY` | 通过部署 secrets 注入，不提交 |
| Session | `CSRF_HMAC_SECRET` | 生产随机密钥；以 Session ID 派生 CSRF Token，多实例一致，轮换使旧 CSRF Token 失效 |
| 模型 | `AI_PROVIDER_MODE`、`AI_PROVIDER_CREDENTIAL_*` | mock/real；凭证具体 suffix 在适配器落地时登记 |
| 任务 | `IMAGE_CONCURRENCY`、`IMAGE_TIMEOUT_MS`、`MAX_PENDING_OUTPUTS` | 默认对应本文容量；启动校验正整数 |
| 上传 | `MAX_UPLOAD_BYTES`、`MAX_IMAGE_PIXELS`、`PROJECT_UPLOAD_QUOTA_BYTES` | 默认 25 MiB、40MP、2 GiB |
| 运维 | `TRUSTED_PROXY_CIDRS`、`BACKUP_TARGET` | 代理仅信任已部署入口，禁止任意来源伪造 IP |
| Web | `VITE_API_BASE_URL` | 默认 `/api/v1`；任何 VITE_* 均视为公开数据 |

生产拒绝 `AI_PROVIDER_MODE=mock`，除非明确标识独立演示环境，且演示数据不计入真实上线验收。价格、系统/用户额度和模型启用状态在数据库配置，不因环境变量缺失而默认无限。

### 11.3 初始化和开发命令

下列是 **M0 必须实现的根 package scripts 契约**，当前仓库尚无这些脚本，不能描述为现在直接可执行。实现时用 Node 脚本兼容 PowerShell/Linux，不依赖 Bash 专用语法或根目录 `cp/rm` 假设。

| 命令 | 必须完成的动作 |
|---|---|
| `pnpm infra:up` / `pnpm infra:down` | 启停开发 PG/Redis/RustFS；down 不删除数据卷 |
| `pnpm storage:init` | 幂等创建私有 Bucket 和开发 CORS；不打印凭证 |
| `pnpm db:generate` | 生成待审 SQL，禁止直接推生产 Schema |
| `pnpm db:migrate` | 对当前目标 DB 执行已审核迁移 |
| `pnpm db:seed` | 仅 dev/test 可运行的幂等样例数据 |
| `pnpm user:bootstrap` | 受控创建首个管理员；交互输入或安全注入密码，不含默认生产密码 |
| `pnpm dev` | 依赖包 watch + API/Worker/Web；错误时给出缺失前置服务 |
| `pnpm lint` / `pnpm typecheck` | ESLint + vue-tsc/tsc，全 workspace |
| `pnpm check:boundaries` | 跨 app/私有路径/服务端进入 Web/循环依赖检查 |
| `pnpm api:generate` | 无需真实模型联网，导出 OpenAPI 并生成 Client 类型 |
| `pnpm api:check` | 临时重新生成，比较提交产物，无差异才通过 |
| `pnpm test` / `pnpm test:integration` / `pnpm test:e2e` | 单元、真实依赖集成、浏览器完整流程 |
| `pnpm build` | 先共享包再应用，产出三个可独立部署产物 |
| `pnpm check` | lint + typecheck + boundaries + api:check + 单元测试 |

干净检出后的标准顺序：安装锁定 Node/pnpm → 复制 `.env.example` 为本地配置并填入开发凭证 → `pnpm install --frozen-lockfile` → `pnpm infra:up` → `pnpm storage:init` → `pnpm db:migrate` → `pnpm db:seed` → `pnpm user:bootstrap` → `pnpm dev`。M0 的 DEVELOPMENT.md 必须记录实际端口和已验证命令。

### 11.4 发布与恢复

发布顺序：CI 构建不可变镜像 → 备份并验证备份可读 → 停止或排空不兼容旧 Worker → 单次 migrate → storage-init → 启动 API/Worker/Web → 检查健康 → 浏览器冒烟。默认使用向后兼容的 expand/contract 迁移；迁移破坏兼容性时制定维护窗口与恢复方案。回滚应用不等于数据库可自动降级。

生产持久数据位于 `/opt/exhibition-ai/{postgres,redis,rustfs,backups}` 或等效受控卷。Redis 使用持久化和 `noeviction`；其重建不能造成 PG 任务丢失。容器重建不删除数据卷，运行目录权限按镜像实际 UID/GID 验证。

备份至少每日一次，保留 7 个日备份和 4 个周备份，复制到与应用磁盘独立的位置；开发机或同盘 backups 不算灾备。MVP 一致性备份窗口暂停新写入和对象清理、排空 Worker 后备份 DB 与对象，保存文件清单/校验值，再恢复服务。Session 可不恢复，由用户重新登录。

建议验收目标：RPO ≤24 小时、RTO ≤4 小时，必须通过演练测量；不是本文已经达成的指标。恢复在空环境还原 DB/对象、重建队列、对账非终态任务，验证抽样资产 hash、版本树、下载和登录，再切流量。对象复制或备份校验失败需告警。

### 11.5 日志、指标与告警

API 使用 Pino JSON，包含 requestId、route、status、duration；Worker 包含 taskId/output/attemptId/providerRequestId（安全摘要）。禁止记录完整 Cookie、Authorization、签名 URL、上传原文或全量 Prompt；Prompt 仅在受限任务快照存储。

健康：live 表示进程存活；API ready 检查 DB、Redis 和必要配置；Worker 以数据库/Redis 心跳和最近处理时间检查。第三方模型暂不可用影响模型健康，不导致容器反复重启。

指标：请求延迟/错误率、任务 pending 时长、成功/部分成功/失败比例、活跃/未知任务数、Outbox 最老年龄、Provider 限流、预留与实际费用、磁盘/内存和备份年龄。Outbox >60 秒、reconciling >15 分钟、磁盘 >80%、备份 >26 小时产生运维告警；通知目标由部署配置，测试不向外部真实发送。

业务历史默认保留至管理员按公司策略批准清理；普通运行日志 30 天、审计与费用记录至少 180 天、SSE 事件 7 天、临时对象 24 小时、ZIP 导出 7 天。过期 ZIP 可重建，版本原图不能随导出过期一起删除。上线前在 RUNBOOK 固化公司的数据保留决定。

## 12. 非功能要求与验收方法

以下是目标，不是已有测试结论。若测量未达到，提交瓶颈与调整方案，不修改报告伪装通过。

| 编号 | 要求 | 验收方法 |
|---|---|---|
| NFR-01 | 20 在线用户、1 万项目/10 万资产基准集，常用元数据 API P95 <500ms | 排除模型/文件传输耗时，固定上述环境记录压测脚本和结果 |
| NFR-02 | 创建生成任务 P95 <1s，立即返回 taskId | Mock Provider 人为延迟，HTTP 不能随模型阻塞 |
| NFR-03 | 局域网已提交事件到 UI 更新 P95 <2s | 真实反代链路测事件时间；断线重连后 5 秒内恢复可见终态 |
| NFR-04 | 首屏关键 Web 资源压缩后建议 ≤500KiB，图片不计入 JS | 构建分析；AI/编辑组件路由懒加载，超出需说明来源 |
| NFR-05 | 参考网络 10Mbps、50ms RTT 下项目页主要内容 ≤3s 可操作 | 有缓存/无缓存各测，原图采用按需加载 |
| NFR-06 | 所有资源读写均有范围授权；Secret 不进入前端产物 | 集成越权矩阵、构建产物扫描、人工日志抽查 |
| NFR-07 | 键盘能完成建项目、上传、生成、选图和导出 | Playwright + 人工焦点/屏幕阅读器抽查；色彩对比按 WCAG AA 目标 |
| NFR-08 | Worker 重启、重复投递不丢历史，不重复发布同一输出 | 故障注入集成测试，记录数据库结果与 Provider 调用次数 |
| NFR-09 | 生成质量可人工评估、结果可追溯 | 10 组经授权的 Brief 样本，每组首轮 3 图和一次修改，按下列维度记录 |

质量维度：需求关键项覆盖、布局可理解性、品牌色/Logo 表现、视觉质量、修改指令落实、参考图保持程度；每维 1～5 分，至少 8/10 组经业务审核达到平均 3 分且有可继续深化的方案。低分保留失败例子与限制，不靠单张精选图宣告可用。精确尺寸和施工合规不作为图像模型可自动保证的评分承诺。

## 13. 分阶段实施与完成标准

### 13.1 任务包和依赖

| 里程碑 | 依赖 | 交付内容 | 必须通过的验收 |
|---|---|---|---|
| M0 工程与契约 | 无 | 版本证据、Monorepo、三应用入口、公共包边界、Compose、CI、开发脚本、Mock | 冻结安装/独立构建、边界检查、OpenAPI→Web 类型、干净检出启动 |
| M1 基础业务与文件 | M0 | Auth/RBAC、客户/项目/成员、Brief revision、最小 Task/Outbox/Worker、上传校验/缩略图、私有存储 | 角色/越权、revision 冲突、真实 RustFS 直传/下载、重传不能替换 ready 图、校验任务重投幂等 |
| M2 可靠生成闭环 | M1 | 扩展 Task/attempt/output、AI Brief 解析/方向生成、Provider adapter、费用、取消/恢复 | Mock 多图成功/部分失败/超时未知；Redis 中断、重复投递、重复请求、Worker 崩溃 |
| M3 设计工作台 | M2 | 三栏 UI、版本树、历史分叉、比较/选图、SSE、任务中心 | 刷新恢复、重连补发、并发选图冲突、旧 Brief 修改确认、响应式和键盘 |
| M4 Agent 与审核 | M3 | 会话、工具、confirmation、Prompt 版本、审批/归档 | 参数绑定、重复批准、撤权/过期、工具调用上限、审批锁定规则 |
| M5 可交付上线 | M4 | ZIP/原图下载、设置/审计、真实 Provider 冒烟、质量评估、备份恢复、RUNBOOK | 全链路 E2E、NFR、恢复演练、真实生成+修改、独立 HTTPS 访问直传 |

审计、错误和费用随涉及操作同步实现，M5 只是补齐查询界面和上线验证，不能拖到最后补埋点。M2 开始就应测试真实 Provider 能力，最迟 M5 完成业务样本评估；发现不支持编辑时应换已验证适配器，而非把编辑需求删除。

### 13.2 关键验收场景

| 用例 | 场景 | 预期 |
|---|---|---|
| AC-01 | designer 建项目、录入/确认 Brief、上传 Logo/参考图、生成 3 图、选中一张再修改并导出 | 形成可下载原图/ZIP，来源、版本、费用和审计可追溯 |
| AC-02 | viewer 直接调用生成接口；非成员猜 assetId/taskId/conversationId | 分别 403/404；无签名、无 SSE 内容、无新任务 |
| AC-03 | 同 Idempotency-Key 发两次；同 key 改参数再发 | 两次返回同任务；改参返回 409，无双额度预留 |
| AC-04 | 排队后修改 Brief | 旧任务使用原快照；新任务必须重新确认新 revision |
| AC-05 | DB 事务提交后、入队前 API 退出；Redis 暂停 | Outbox 恢复后任务可执行，无静默丢失 |
| AC-06 | Provider 接收后 Worker 超时/被杀死 | 进入 reconciling，不盲重发；Mock 记录调用次数，真实环境核对 requestId |
| AC-07 | 3 张成功 2 张；仅重试失败图 | 保留两张旧图，新 Task 只生成一张；版本、费用唯一 |
| AC-08 | queued 取消、running 取消、完成与取消同时发生 | 按 CAS 规则固定终态，不从 cancelled 回跳 success |
| AC-09 | 两人同时选图/保存 Brief | 一次成功，另一次 409；本地输入可恢复，无多选中版本 |
| AC-10 | SSE 断线、重复事件、过期 cursor、成员被移除 | REST/快照恢复，不重复消息、不倒退状态；撤权后停止推送 |
| AC-11 | 假 MIME/超大图/未上传 complete/重复 complete/过期签名/临时 key 重传 | 拒绝无效输入，复用同资产，不破坏 ready 原图 |
| AC-12 | 从 V1 分叉、切回旧图、隐藏父图的素材 | 分叉保留；单一选中指针；被引用内容不丢失 |
| AC-13 | confirmation 过期/改参/重复批准/非发起人批准 | 无越权生成；有效重复批准复用原 Task |
| AC-14 | 两个同时触及最后余额的请求；跨日任务完成 | 原子额度保护；仅正确日期结算一次，无负数可用额度 |
| AC-15 | reviewed/approved 项目尝试修改；归档时仍有任务 | 返回 409/禁止操作；完成规定状态转换后才允许 |
| AC-16 | 空机按 RUNBOOK 恢复 PG 与对象 | 登录、版本树、抽样原图 hash、下载正常；非终态任务有恢复结论 |
| AC-17 | 本机以外浏览器通过正式 HTTPS 域名使用 | SPA 深链接、Cookie/CSRF、SSE、S3 签名 Host/CORS 全部成功 |
| AC-18 | disabled/unknown 模型、模型不支持 edit、Mock 被生产误配置 | 启动或请求被明确拒绝，不隐式换模型/调用真实服务 |

### 13.3 测试分层与 Definition of Done

单元测试关注权限、状态转换、费用计算、Prompt 快照、版本/幂等规则。API 测试用 `Fastify.inject` 覆盖 Schema、错误和授权。集成测试在隔离 DB/Bucket/队列命名空间中运行真实依赖，模型 Mock 提供 delayed、partial、reject、unknown-after-accept、duplicate-result 模式。E2E 按 FR/AC 编号命名或标注。

每个任务包交付时必须：范围内功能完成；新增路径符合第 6 节；迁移已审阅且能从空库和上一版本升级；OpenAPI 与 Client 同步；相关检查通过；README/DEVELOPMENT 与实际命令相符；失败/未运行项目明确记录原因。不得以 `any`、禁用测试、占位成功状态或伪造 Provider 返回值通过验收。

CI 默认不使用真实模型 key、不调用付费接口。真实 Provider 冒烟单独执行，记录日期、配置版本、用量与生成/修改结果；不提交敏感素材。上线报告分别列出 Mock 证据、真实依赖证据、真实 Provider 证据和人工质量评估。

## 14. 后续阶段的扩展边界

P1 知识库归入新的 `knowledge` 业务模块与对应 contracts/Web 路由，不混入 assets 文件读写实现。文档本体仍是 asset；新增 documents/chunks/embeddings，明确解析状态、来源页码、embedding model/维度/版本和重建任务。先做权限过滤再取检索结果，过滤不足需继续检索补足，不能泄露无权案例。模型/维度切换使用新索引迁移，不混用向量。

P1 PDF 提案是 export task 的新 format，与 ZIP 共用授权和快照；引入渲染依赖后单独验证字体、分页、中文和大图内存。不把 PDF 生成塞进 API request。

P2 图像编辑器放 `modules/design` 下的专门 editor 子模块，只有需要对象化编辑时引入 Konva/Fabric；ComfyUI 接入 `packages/ai/providers` 并由 Worker 调度。新增 Mask 与工作流版本、输出能力说明，不破坏已有 ImageProvider 的错误/取消/计费契约。

多组织 SaaS 若确有业务需求，先新增独立 ADR 和数据迁移计划，再对组织归属、授权、存储键、唯一约束、费用和检索范围整体设计；MVP 不能因为“以后可能”而半实现 tenantId。

## 15. 给后续 AI 开发的执行约定

1. 开始前读取本文、当前里程碑、已有源码和依赖锁文件；确认哪些已实现，不能仅根据目标目录假定代码存在。
2. 一次实现一个可端到端验收的任务包，先给出 FR/AC 编号、允许修改目录、依赖与验证方法；需求已明确的低风险实现不反复询问。
3. 数据改动先设计约束和迁移；接口先改 contracts；然后业务服务、入口/Worker、生成 Client、Web 和验收，确保垂直闭环。
4. 使用第 6 节唯一目录归属。除非有已记录的具体理由，不新增顶层目录、万能 common 包、第二套数据库客户端或跨 app 源码引用。
5. 框架/SDK 的真实签名以锁定版本的官方文档和已安装类型为准；不凭记忆发明模型 ID、插件名、配置键或未存在的脚本。
6. 不改变已定义权限、审批、费用、取消或历史保留规则来绕过实现困难；确需调整时记录 ADR，并更新需求、Schema、测试和界面说明。
7. 完成后报告改动、迁移、契约变化、实际运行的检查、失败/未验证事项及下一依赖；不把模拟结果描述成真实可用。

推荐交给 AI 的任务格式：

```text
以 docs/REQUIREMENTS_AI_DEVELOPMENT.md 为需求基线，实现 M1 的 FR-04。
先检查 M0 和项目/权限前置是否已完成；仅实现 Brief 保存、版本历史、确认与冲突处理。
遵循第 6 节目录边界，补齐 Schema/迁移/API/Client/Web 和 AC-04、AC-09 相关证据。
AI 解析接口若前置 Worker 尚未完成，明确列为后续依赖，不返回伪造成功。
不要实现知识库、不要更改授权规则，不修改指令文件。
完成后说明实际运行检查及未完成的依赖。
```

需要真实外部条件的事项只有：模型账号与实际能力、费用额度、部署域名/机器/备份目标、公司保留策略与业务质量审核人。它们在各自里程碑前落实；不阻塞基于 Mock 的工程、权限、存储和任务机制开发，也不能被 AI 自行编造成已验证事实。
