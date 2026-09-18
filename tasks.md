# 开发任务清单

更新日期：2026-09-14。需求来源：[完整需求规范](docs/REQUIREMENTS_AI_DEVELOPMENT.md)。本轮明确：**所有开发服务使用 Docker；所有功能以 GitHub Issue 跟踪，并按 Issue 建分支、提交 PR。**

已在 [bao-linfeng/exhibition-ai](https://github.com/bao-linfeng/exhibition-ai/issues) 发布并回读核验全部 41 个任务（#1～#41），本地编号与真实 Issue 一一映射。功能全部未实现、未勾选；功能 PR 尚未创建。逐项正文与发布映射见 [docs/issues](docs/issues/README.md)。[规划文档 PR #42](https://github.com/bao-linfeng/exhibition-ai/pull/42) 仅记录本计划，不关闭任何功能 Issue；各任务的 PR 字段专用于后续功能实现。

## 完成与依赖规则

- `T001`～`T041` 是稳定本地 ID；发布后保留 ID，并回填真实 `#number`、Issue URL 和 PR URL。
- 顶层复选框仅在实现完成、相关验收通过且 PR 合并后勾选；子项用于跟踪验收进度。关闭 Issue、仅写代码、只有 Mock、创建 PR 都不自动等于完成。
- 默认状态为 `todo`；需要时记录 `blocked/in_progress/in_review/done`。缺模型账号仅阻塞真实 Provider 任务及最终上线验收，Mock开发继续。
- MVP 为 T001～T031；P1 为 T032～T037；P2 为 T038～T040；T041仅独立需求评估。多组织 SaaS 仍是条件性扩展，不擅自纳入当前实现范围。
- 前置依赖是实施顺序；每阶段内无依赖冲突的任务可分别开发，禁止跨分支导入未合并源码。
- 所有业务 Issue 同步实现范围内 Schema、迁移、Service/Policy、API/Worker、生成Client、Web和验证，不新建平行目录。
- 任务细节以需求规范为准；本文件决定任务归属和本轮 Docker/Issue 流程。范围变化同步更新两者和相关 Issue，禁止静默删减验收。

## Docker 开发与验证约定

标准开发环境由 `infra/compose.dev.yaml` 定义；`web/api/worker/postgres/redis/rustfs` 为长期服务，`devtools/migrate/storage-init` 为工具或一次性服务。生产另用 `infra/compose.prod.yaml`，不使用开发watch镜像发布。

宿主机只要求 Git、Docker Engine/Desktop 和 Compose v2；Node/pnpm/构建/数据库迁移/seed/测试在容器内执行。Web 使用容器内Vite热更新，API/Worker及共享包watch；源码bind mount，容器依赖卷与宿主机隔离。PG/Redis/RustFS使用持久卷；普通停止/重建保留数据。

以下是 **T002需要实现并验证的命令合同，目前Compose和应用尚不存在，不能立即执行**。T002须固定服务工作目录、启动依赖、工具profiles、实际端口和环境变量加载方式，并将真实可用命令写入 DEVELOPMENT.md：

```powershell
docker compose --env-file .env -f infra/compose.dev.yaml build
docker compose --env-file .env -f infra/compose.dev.yaml run --rm devtools pnpm install --frozen-lockfile
docker compose --env-file .env -f infra/compose.dev.yaml up -d postgres redis rustfs
docker compose --env-file .env -f infra/compose.dev.yaml run --rm storage-init
docker compose --env-file .env -f infra/compose.dev.yaml run --rm migrate
docker compose --env-file .env -f infra/compose.dev.yaml run --rm devtools pnpm db:seed
docker compose --env-file .env -f infra/compose.dev.yaml run --rm devtools pnpm user:bootstrap
docker compose --env-file .env -f infra/compose.dev.yaml up -d web api worker
docker compose --env-file .env -f infra/compose.dev.yaml logs -f web api worker
docker compose --env-file .env -f infra/compose.dev.yaml run --rm devtools pnpm check
docker compose --env-file .env -f infra/compose.dev.yaml run --rm devtools pnpm build
docker compose --env-file .env -f infra/compose.dev.yaml run --rm devtools pnpm test:integration
docker compose --env-file .env -f infra/compose.dev.yaml run --rm devtools pnpm test:e2e
docker compose --env-file .env -f infra/compose.dev.yaml down
```

首次复制 `.env.example` 并填写本地配置，不提交凭证。初始化步骤幂等；迁移/存储初始化必须检查依赖健康后执行。seed仅dev/test；管理员密码通过受控交互或安全注入。首次锁文件生成属于T001引导步骤，完成后才强制frozen安装。测试使用隔离数据库、Bucket、队列和Compose项目名；不可破坏开发数据。工具容器需包含实际测试所需的浏览器/原生依赖；不得依赖宿主机未记录的软件。

对象签名使用浏览器可达地址；服务间使用Docker DNS。开发仅绑定必要本地端口，生产数据库/Redis/控制台/API原始端口不公开。除明确的数据重置操作外，命令禁止附带 `down -v`。

## GitHub Issue → 分支 → PR 流程

1. 确认目标仓库和默认分支；已有仓库先读取现有Issues（含关闭项），按正文中的 `task-id: Txxx` 和标题查重。未指定仓库不得猜测创建；本任务不自动新建远程仓库。
2. 用 `docs/issues/Txxx.md` 发布对应Issue，保留任务ID；按M0→M5→P1→P2顺序建立全部41项。先创建获取编号，再把依赖补为真实Issue链接；不要猜编号或把T编号写成 `#001`。
3. 每成功一项立即保存真实编号/URL到manifest，并回填下方任务记录。若请求结果不明，先查重确认，再重试。状态统计以真实GitHub结果为准，不重复批量创建。
4. 可使用已有阶段/类型标签；不存在时先建匹配标签再引用。阶段由正文保证，缺标签不应导致重复Issue。此轮不指派其他人、不自动发送额外通知。
5. 开发时只领取前置已合并的Issue。从更新后的默认分支创建 `feat/issue-<number>-<slug>`；工程任务用 `chore/`，修复用 `fix/`。本地未初始化时先与已确认的远程对齐，避免覆盖已有文件。
6. 在该分支完成一个Issue范围内的代码、测试和文档；保持应用目录符合技术栈。提交信息关联 `#number`，不把无关功能混入。
7. 推送分支并提交PR到默认分支，正文写 `Closes #number`、具体行为、Docker验证证据、迁移/配置及限制。未达到验收时保持Draft或明确未完成项。
8. 根据review修改，相关检查通过后按仓库合并权限处理；本清单不授权跳过保护规则或直接生产部署。PR合并后复核Issue关闭及验收，再勾选任务并回填PR链接；追踪回填可由独立小型文档PR提交。
9. 若后续发现未完成范围，保留未勾选状态并重开或建立关联补充Issue。不要用 `not planned` 关闭替代实现交付。

## 需求覆盖索引

| 需求 | 主任务 |
|---|---|
| FR-01 认证与授权 | T006、T007、T028；子资源Issue各自复核 |
| FR-02 项目生命周期 | T007、T009、T026 |
| FR-03 客户、项目、仪表盘 | T007、T008、T022 |
| FR-04 Brief | T009、T017、T020 |
| FR-05 素材 | T010、T011、T012、T030 |
| FR-06 方向、生成、修改 | T013～T020 |
| FR-07 任务 | T010、T013、T016、T018、T021、T022 |
| FR-08 版本 | T016、T020 |
| FR-09 Agent | T024、T025 |
| FR-10 导出 | T027 |
| FR-11 审计费用 | T004基础；T006起随业务埋点；T014、T028 |
| FR-12 配置 | T014、T015、T019、T028 |
| AC-01～AC-18 | T031总验收；各任务标明专项场景 |
| NFR-01～NFR-09 | T031总验收；T005、T018、T021、T023、T029、T030专项支撑 |

## 可勾选任务

### M0

- [x] **T001 锁定技术栈并建立 Monorepo 工程** — [Issue 正文](docs/issues/T001.md)

  阶段：M0；前置：无；状态：done；GitHub Issue：[#1](https://github.com/bao-linfeng/exhibition-ai/issues/1)；PR：[#43](https://github.com/bao-linfeng/exhibition-ai/pull/43)（已关闭，实现含于 main 提交 8cc9162、89fba80）。

  需求：§5、§6。目录：apps/*；packages/*；根配置；docs/DEPENDENCY_BASELINE.md。

  范围：核实并锁定 Node/pnpm/框架兼容版本；建立三应用和五个共享包的最小有效入口；配置 TS ESM、显式 exports、唯一锁文件和格式检查。

  - [x] 记录官方来源、peer dependencies 和安装/构建结果，不使用 floating latest
  - [x] 容器内 frozen-lockfile 安装及三应用独立构建成功
  - [x] Web 不依赖 Node 服务端包；不创建空业务模块或第二套目录

- [x] **T002 实现 Docker Compose 全服务开发环境** — [Issue 正文](docs/issues/T002.md)

  阶段：M0；前置：[T001 #1](https://github.com/bao-linfeng/exhibition-ai/issues/1)；状态：done；GitHub Issue：[#2](https://github.com/bao-linfeng/exhibition-ai/issues/2)；PR：[#44](https://github.com/bao-linfeng/exhibition-ai/pull/44)（已关闭，实现含于 main 提交 8cc9162、89fba80）。

  需求：§6、§11；本轮 Docker 要求。目录：infra/compose.dev.yaml；infra/docker/*；infra/nginx/*；scripts/*；docs/DEVELOPMENT.md；.env.example。

  范围：Web/Vite、API、Worker、PostgreSQL、Redis、RustFS 全部容器运行；提供 devtools、migrate、storage-init 一次性服务；实现源码热更新、独立依赖卷、内部网络和浏览器可达对象入口。

  - [x] 干净检出仅需 Git、Docker Engine/Desktop 与 Compose v2即可启动，不要求宿主机 Node/pnpm/数据库
  - [x] Windows PowerShell 与 Linux 验证热更新、Vite HMR、API代理、容器DNS和实际端口；宿主机 node_modules 不挂入容器
  - [x] down/up 和应用重建后数据仍在；默认停止命令不含 -v；记录初始化顺序、失败诊断及无明文凭证的配置示例

- [x] **T003 建立 API 契约、错误协议和共享代码边界** — [Issue 正文](docs/issues/T003.md)

  阶段：M0；前置：[T001 #1](https://github.com/bao-linfeng/exhibition-ai/issues/1)、[T002 #2](https://github.com/bao-linfeng/exhibition-ai/issues/2)；状态：done；GitHub Issue：[#3](https://github.com/bao-linfeng/exhibition-ai/issues/3)；PR：[#45](https://github.com/bao-linfeng/exhibition-ai/pull/45)。

  需求：§6、§9。目录：packages/contracts；packages/api-client；apps/api/src/plugins；scripts；docs/api。

  范围：建立 /api/v1、TypeBox 请求/响应校验、错误映射、分页/revision/幂等协议；导出 OpenAPI 并生成客户端类型；落实跨包和 Web 模块依赖检查。

  - [x] 容器内 api:generate/api:check 通过且生成无需真实模型
  - [x] Fastify 示例接口与 Web 类型化调用贯通，错误不泄露堆栈
  - [x] 跨 app、跨包私有 src、服务端进入 Web、循环依赖违规样例能被检查拒绝

- [x] **T004 建立数据库迁移、配置和日志基础** — [Issue 正文](docs/issues/T004.md)

  阶段：M0；前置：[T001 #1](https://github.com/bao-linfeng/exhibition-ai/issues/1)、[T002 #2](https://github.com/bao-linfeng/exhibition-ai/issues/2)；状态：done；GitHub Issue：[#4](https://github.com/bao-linfeng/exhibition-ai/issues/4)；PR：[#47](https://github.com/bao-linfeng/exhibition-ai/pull/47)（初始实现）、[#48](https://github.com/bao-linfeng/exhibition-ai/pull/48)（补充修复：pino日志、seed防护、health模块化）。

  需求：§7、§11.2、§11.5。目录：packages/db；packages/backend/src/infrastructure；apps/api/src/health；apps/worker/src。

  范围：实现单例连接与事务注入、迁移runner、dev/test seed入口、环境Schema、Pino脱敏和进程健康/优雅退出；各业务表随后由所属Issue增加。 提供追加式审计基础表/服务，供认证和业务Issue同步埋点。

  - [x] 空数据库迁移和重复执行成功，seed 在生产被拒绝
  - [x] 缺少生产必填配置明确退出，日志隐藏凭证与签名query
  - [x] API live/ready和Worker心跳可观测，关闭能停止接新任务并释放连接

- [x] **T005 建立容器 CI 与 Issue/PR 交付门禁** — [Issue 正文](docs/issues/T005.md)

  阶段：M0；前置：[T002 #2](https://github.com/bao-linfeng/exhibition-ai/issues/2)、[T003 #3](https://github.com/bao-linfeng/exhibition-ai/issues/3)、[T004 #4](https://github.com/bao-linfeng/exhibition-ai/issues/4)；状态：done；GitHub Issue：[#5](https://github.com/bao-linfeng/exhibition-ai/issues/5)；PR：[#49](https://github.com/bao-linfeng/exhibition-ai/pull/49)。

  需求：§13.3、§15；tasks.md。目录：.github/workflows；.github/pull_request_template.md；scripts；tests；docs/DEVELOPMENT.md。

  范围：CI 在隔离 Compose 环境执行 lint/typecheck/boundaries/api:check/unit/build；提供真实依赖集成与E2E入口；PR模板要求Issue、目录、迁移、Docker验证与未验证项。

  - [x] 干净runner可重建镜像并执行检查，不读取开发数据卷
  - [x] CI只使用无敏感数据与Mock，不自动调用付费模型
  - [x] PR可追踪关联Issue及依赖；失败检查阻止标记完成，模板不把未运行CI预填为通过

### M1

- [x] **T006 实现登录、Session 和账号安全** — [Issue 正文](docs/issues/T006.md)

  阶段：M1；前置：[T003 #3](https://github.com/bao-linfeng/exhibition-ai/issues/3)、[T004 #4](https://github.com/bao-linfeng/exhibition-ai/issues/4)；状态：done；GitHub Issue：[#6](https://github.com/bao-linfeng/exhibition-ai/issues/6)；PR：待创建。

  需求：FR-01、AC-02、NFR-06。目录：packages/backend/src/modules/auth；packages/backend/src/modules/users；packages/db；apps/api/src/modules/auth；apps/api/src/plugins；apps/web/src/modules/auth。

  范围：实现登录/退出/me、Argon2id、数据库Session、Origin/CSRF、限流、首登改密和本人改密；受控容器命令初始化管理员及重置临时密码。

  - [x] 空闲8小时/绝对7天过期、退出和停用失效；凭证不进localStorage
  - [x] 可信Origin/CSRF及登录限流有正反测试；生产Cookie配置符合基线
  - [x] 无默认生产密码，容器命令不打印密码；首登必须改密

- [x] **T007 实现客户、项目、成员和范围授权** — [Issue 正文](docs/issues/T007.md)

  阶段：M1；前置：[T006 #6](https://github.com/bao-linfeng/exhibition-ai/issues/6)；状态：done；GitHub Issue：[#7](https://github.com/bao-linfeng/exhibition-ai/issues/7)；PR：[#50](https://github.com/bao-linfeng/exhibition-ai/pull/50)。

  需求：FR-01～FR-03、AC-02、AC-09。目录：packages/backend/src/modules/{customers,projects}；packages/db；apps/api/src/modules；apps/web/src/modules/{customers,projects}。

  范围：实现客户可见/编辑/停用、项目创建/编辑/过滤/分页、负责人转交、成员管理和共享授权Policy；创建项目事务创建默认会话记录；状态审核操作留T026。

  - [x] admin/designer/sales/viewer及负责人交叉矩阵通过，最后负责人不可直接移除
  - [x] 对象越权404、操作不足403；客户停用不破坏历史项目
  - [x] revision冲突409保留本地输入；列表无跨项目泄漏，游标稳定

- [x] **T008 实现 Web 应用壳、路由和缓存约定** — [Issue 正文](docs/issues/T008.md)

  阶段：M1；前置：[T003 #3](https://github.com/bao-linfeng/exhibition-ai/issues/3)、[T006 #6](https://github.com/bao-linfeng/exhibition-ai/issues/6)、[T007 #7](https://github.com/bao-linfeng/exhibition-ai/issues/7)；状态：done；GitHub Issue：[#8](https://github.com/bao-linfeng/exhibition-ai/issues/8)；PR：[#51](https://github.com/bao-linfeng/exhibition-ai/pull/51)。

  需求：§4、§6.2、FR-03。目录：apps/web/src/router；apps/web/src/shared；apps/web/src/components；apps/web/src/views/dashboard。

  范围：集成 shadcn-vue/Tailwind、显式懒加载路由、页面布局、统一错误与空状态；实现可见项目/任务摘要接口及dashboard；Query 管服务端数据，Pinia限UI与用户摘要。

  - [x] 登录返回地址仅站内、深链/404正确；未交付功能不显示占位菜单
  - [x] Query key隔离用户/项目，退出和切换项目不闪现旧数据
  - [x] 基础页面loading/empty/error/forbidden、键盘焦点与窄屏可用

- [x] **T009 实现结构化 Brief 版本与确认** — [Issue 正文](docs/issues/T009.md)

  阶段：M1；前置：[T007 #7](https://github.com/bao-linfeng/exhibition-ai/issues/7)、[T008 #8](https://github.com/bao-linfeng/exhibition-ai/issues/8)；状态：done；GitHub Issue：[#9](https://github.com/bao-linfeng/exhibition-ai/issues/9)；PR：[#52](https://github.com/bao-linfeng/exhibition-ai/pull/52)。

  需求：FR-04、AC-04、AC-09。目录：packages/backend/src/modules/briefs；packages/db；packages/contracts；apps/api/src/modules/briefs；apps/web/src/modules/briefs。

  范围：实现字段校验、保存不可变revision、历史/差异查看、显式确认、面积派生和有效项目状态转换；AI解析留T017。

  - [x] 尺寸/朝向/品牌/功能区/预算/日期等校验按需求表一致
  - [x] 修改生成新revision并撤销当前确认；重复和并发确认/保存遵守revision
  - [x] 历史快照不可被新编辑覆盖；409保留本地输入

- [x] **T010 实现最小持久化 Task、Outbox 和 Worker** — [Issue 正文](docs/issues/T010.md)

  阶段：M1；前置：[T003 #3](https://github.com/bao-linfeng/exhibition-ai/issues/3)、[T004 #4](https://github.com/bao-linfeng/exhibition-ai/issues/4)、[T007 #7](https://github.com/bao-linfeng/exhibition-ai/issues/7)；状态：done；GitHub Issue：[#10](https://github.com/bao-linfeng/exhibition-ai/issues/10)；PR：[#53](https://github.com/bao-linfeng/exhibition-ai/pull/53)。

  需求：FR-07、§8、AC-05。目录：packages/backend/src/modules/tasks；packages/backend/src/infrastructure/queue；packages/db；apps/worker/src。

  范围：为资产校验建立Task/Outbox事务、可靠投递、幂等处理、恢复扫描与基础任务查询；预留各Task kind独立前置，图片attempt/output由T013扩展。

  - [x] DB提交后API退出、Redis中断后仍可恢复处理
  - [x] 重复投递同一校验任务不重复发布资产或副作用
  - [x] 上传校验不要求已确认Brief；Worker重启可恢复，任务状态数据库为真源

- [x] **T011 实现私有对象存储和签名直传** — [Issue 正文](docs/issues/T011.md)

  阶段：M1；前置：[T002 #2](https://github.com/bao-linfeng/exhibition-ai/issues/2)、[T007 #7](https://github.com/bao-linfeng/exhibition-ai/issues/7)、[T010 #10](https://github.com/bao-linfeng/exhibition-ai/issues/10)；状态：done；GitHub Issue：[#11](https://github.com/bao-linfeng/exhibition-ai/issues/11)；PR：[#54](https://github.com/bao-linfeng/exhibition-ai/pull/54)。

  需求：FR-05、§10、AC-11、AC-17。目录：packages/backend/src/infrastructure/storage；packages/backend/src/modules/assets；packages/db；apps/api/src/modules/assets；infra。

  范围：实现StorageProvider流式接口、临时upload session、PUT/GET签名、幂等complete和下载授权；分离internal/public endpoint，初始化私有Bucket和精确CORS。

  - [x] 真实RustFS PUT/GET/HEAD、签名过期、错误Host、CORS和浏览器直传有证据
  - [x] 未上传complete失败；重复complete返回同资产/Task
  - [x] 对象入口可达但无匿名读写权限；DB/日志不持久保存完整签名URL

- [x] **T012 实现素材校验、缩略图和上传管理页** — [Issue 正文](docs/issues/T012.md)

  阶段：M1；前置：[T008 #8](https://github.com/bao-linfeng/exhibition-ai/issues/8)、[T010 #10](https://github.com/bao-linfeng/exhibition-ai/issues/10)、[T011 #11](https://github.com/bao-linfeng/exhibition-ai/issues/11)；状态：done；GitHub Issue：[#12](https://github.com/bao-linfeng/exhibition-ai/issues/12)；PR：[#55](https://github.com/bao-linfeng/exhibition-ai/pull/55)。

  需求：FR-05、AC-11、AC-12。目录：apps/worker/src/processors/asset-validation.processor.ts；packages/backend/src/modules/assets；apps/web/src/modules/assets；tests/integration。

  范围：验证文件头/解码/大小/像素/项目配额；写入不可变正式对象、sha256和512px缩略图；实现批量上传、状态/过滤/分页、失败重传和隐藏。

  - [x] PNG/JPEG/WebP，25MiB/40MP/批10份/项目2GiB限制同时落在UI和服务端
  - [x] 修改已签名temp对象不能改变ready资产；校验失败不能用于生成
  - [x] 隐藏后新选择器不可选，历史与已提交任务引用仍可读；损坏/假MIME/超限有负例

### M2

- [x] **T013 扩展图片任务、输出和尝试模型** — [Issue 正文](docs/issues/T013.md)

  阶段：M2；前置：[T009 #9](https://github.com/bao-linfeng/exhibition-ai/issues/9)、[T010 #10](https://github.com/bao-linfeng/exhibition-ai/issues/10)、[T012 #12](https://github.com/bao-linfeng/exhibition-ai/issues/12)；状态：done；GitHub Issue：[#13](https://github.com/bao-linfeng/exhibition-ai/issues/13)；PR：已合并。

  需求：FR-06、FR-07、§7～§9、AC-03、AC-04。目录：packages/backend/src/modules/{tasks,generations}；packages/db；packages/contracts；apps/api/src/modules/generations。

  范围：实现kind前置、请求幂等与参数hash、Task/attempt/output状态和不可变输入快照；创建任务与Outbox同事务；为费用T014和执行T016建立契约。

  - [x] 相同幂等key复用结果，改参409；同事务保存请求与输出计划
  - [x] 新任务使用当前确认Brief，已排队任务不随Brief变化
  - [x] mode=generate/edit字段及模型参数可校验；无前置接口明确拒绝，不返回假成功

- [x] **T014 实现额度预留、费用账本和配置服务** — [Issue 正文](docs/issues/T014.md)

  阶段：M2；前置：[T013 #13](https://github.com/bao-linfeng/exhibition-ai/issues/13)；状态：done；GitHub Issue：[#14](https://github.com/bao-linfeng/exhibition-ai/issues/14)；PR：已合并。

  需求：FR-11、FR-12、§8、AC-03、AC-14。目录：packages/backend/src/modules/{settings,tasks,audit}；packages/db；apps/api/src/modules/settings。

  范围：建立模型启用/能力/价格配置、系统与用户额度、usage账本、原子预留与结算、estimated/actual/unknown；操作随业务写入审计，查询界面后续交付。

  - [x] 并发最后余额仅合法请求成功，可用额度不出现负数
  - [x] attempt分摊Task已有预留，不双扣；新增可计费重试才补额度
  - [x] 跨日按正确period_date结算且只结算一次，未知费用不记为零；原始币种保留

- [x] **T015 实现 AI Provider 契约、Mock 和 Prompt 快照** — [Issue 正文](docs/issues/T015.md)

  阶段：M2；前置：[T003 #3](https://github.com/bao-linfeng/exhibition-ai/issues/3)、[T013 #13](https://github.com/bao-linfeng/exhibition-ai/issues/13)；状态：done；GitHub Issue：[#15](https://github.com/bao-linfeng/exhibition-ai/issues/15)；PR：已合并。

  需求：FR-06、§5、§8、AC-18。目录：packages/backend/src/ports；packages/ai；apps/worker/src/bootstrap.ts；tests/fixtures。

  范围：建立TextProvider/ImageProvider与版本化Prompt、能力配置和错误分类；Mock支持成功/延迟/部分失败/拒绝/接受后未知/重复结果；worker注入，backend不反向导入ai。

  - [x] Mock输出确定且有调用计数、requestId和可验证图片
  - [x] 未知/停用模型、无edit能力、参数不支持被明确拒绝
  - [x] 快照保存最终Prompt和配置版本；Web及日志不泄露凭证/内部Prompt

- [x] **T016 实现多图生成、结果落盘和版本发布** — [Issue 正文](docs/issues/T016.md)

  阶段：M2；前置：[T012 #12](https://github.com/bao-linfeng/exhibition-ai/issues/12)、[T013 #13](https://github.com/bao-linfeng/exhibition-ai/issues/13)、[T014 #14](https://github.com/bao-linfeng/exhibition-ai/issues/14)、[T015 #15](https://github.com/bao-linfeng/exhibition-ai/issues/15)；状态：done；GitHub Issue：[#16](https://github.com/bao-linfeng/exhibition-ai/issues/16)；PR：已合并。

  需求：FR-06、FR-08、AC-07、AC-12。目录：apps/worker/src/processors/image-generation.processor.ts；packages/backend/src/modules/{generations,image-versions}；packages/db。

  范围：执行每批1～4图，逐输出校验并保存asset/image_version；原子发布成功结果、单调sequence和父版本；遵守并发/排队上限，保留部分成功。

  - [x] 3图2成功时保留2版本，失败输出可追踪；重复结果不重复发布版本或费用
  - [x] 图片实际格式/哈希/来源可追踪，下载返回流遵守大小和允许主机限制
  - [x] 生成默认不自动选图；并发版本序号唯一；用户2/系统4/队列100默认容量生效

- [x] **T017 实现 AI Brief 解析和设计方向生成** — [Issue 正文](docs/issues/T017.md)

  阶段：M2；前置：[T009 #9](https://github.com/bao-linfeng/exhibition-ai/issues/9)、[T014 #14](https://github.com/bao-linfeng/exhibition-ai/issues/14)、[T015 #15](https://github.com/bao-linfeng/exhibition-ai/issues/15)；状态：done；GitHub Issue：[#17](https://github.com/bao-linfeng/exhibition-ai/issues/17)；PR：已合并。

  需求：FR-04、FR-06。目录：packages/ai；packages/backend/src/modules/{briefs,generations}；apps/worker/src/processors；apps/web/src/modules/{briefs,generations}。

  范围：用异步Task返回Brief候选/缺失项/待核对项和3个结构化方向；实现候选预览采纳、方向选择，记录文本用量和审计。

  - [x] 解析候选不覆盖已保存Brief，采纳后新revision仍需确认
  - [x] 方向包含布局/材料配色/限制/人工待确认项，不宣称施工认证
  - [x] sales可解析Brief但不能生成方向/图片；结构化输出失败有明确状态

- [x] **T018 实现取消、失败重试和未知任务对账** — [Issue 正文](docs/issues/T018.md)

  阶段：M2；前置：[T016 #16](https://github.com/bao-linfeng/exhibition-ai/issues/16)；状态：done；GitHub Issue：[#18](https://github.com/bao-linfeng/exhibition-ai/issues/18)；PR：已合并。

  需求：FR-07、§8、AC-05～AC-08、AC-14、NFR-08。目录：packages/backend/src/modules/tasks；apps/api/src/modules/tasks；apps/worker/src/schedulers；tests/integration。

  范围：实现排队/运行取消、CAS固定终态、超时/进程死亡对账、过期租约、Provider请求标识恢复；重试生成新Task并只映射失败输出，处理迟到结果和孤儿对象。

  - [x] queued/running/完成取消竞争结果符合基线，cancelled不回跳成功
  - [x] 接受后未知进入reconciling且不盲重发，故障注入校验Provider调用次数
  - [x] 重试只处理失败输出，已有图片/账本不重复；恢复结论与无法自动对账路径可见

- [x] **T019 接入首个真实图片与文本 Provider 并验证能力** — [Issue 正文](docs/issues/T019.md)

  阶段：M2；前置：[T014 #14](https://github.com/bao-linfeng/exhibition-ai/issues/14)、[T015 #15](https://github.com/bao-linfeng/exhibition-ai/issues/15)、[T016 #16](https://github.com/bao-linfeng/exhibition-ai/issues/16)、[T018 #18](https://github.com/bao-linfeng/exhibition-ai/issues/18)；状态：done；GitHub Issue：[#19](https://github.com/bao-linfeng/exhibition-ai/issues/19)；PR：已合并。

  需求：FR-06、AC-18、NFR-09。目录：packages/ai/providers；docs/DEPENDENCY_BASELINE.md；tests/integration。

  范围：按实际账号核实模型ID、生成/edit/参数/取消/幂等/结果查询及计价；实现首个文本和图片适配器；真实调用仅在配置账号与明确测试额度后执行。

  - [x] 记录实际日期/配置/请求摘要/用量与至少一次真实生成和一次基于父图修改
  - [x] 不支持edit不能伪装为编辑；未知执行遵守实际Provider能力
  - [x] 缺少账号或额度标记blocked，Mock证据不得关闭本Issue；密钥与敏感素材不入库

### M3

- [x] **T020 实现自然语言修改与版本比较选图** — [Issue 正文](docs/issues/T020.md)

  阶段：M3；前置：[T008 #8](https://github.com/bao-linfeng/exhibition-ai/issues/8)、[T016 #16](https://github.com/bao-linfeng/exhibition-ai/issues/16)、[T017 #17](https://github.com/bao-linfeng/exhibition-ai/issues/17)、[T018 #18](https://github.com/bao-linfeng/exhibition-ai/issues/18)；状态：done；GitHub Issue：[#20](https://github.com/bao-linfeng/exhibition-ai/issues/20)；PR：已合并。

  需求：FR-06、FR-08、AC-09、AC-12。目录：apps/web/src/modules/{generations,image-versions}；packages/backend/src/modules/image-versions；apps/api/src/modules/image-versions。

  范围：实现生成/修改表单、网格、原图、两图比较、父子树和历史分叉；选中方案单指针+revision；旧Brief父图修改显示差异并记录显式确认。

  - [x] V1分叉并切回旧方案不会丢后续分支
  - [x] 并发选图一次成功另一次409，全项目最多一个选中方案
  - [x] 修改必传父版本和指令，旧Brief确认不能自动勾选；只展示模型支持参数

- [x] **T021 实现持久化 SSE、重连和授权撤销** — [Issue 正文](docs/issues/T021.md)

  阶段：M3；前置：[T006 #6](https://github.com/bao-linfeng/exhibition-ai/issues/6)、[T007 #7](https://github.com/bao-linfeng/exhibition-ai/issues/7)、[T010 #10](https://github.com/bao-linfeng/exhibition-ai/issues/10)、[T016 #16](https://github.com/bao-linfeng/exhibition-ai/issues/16)；状态：done；GitHub Issue：[#21](https://github.com/bao-linfeng/exhibition-ai/issues/21)；PR：已合并。

  需求：§9.3、AC-10、AC-17、NFR-03。目录：apps/api/src/realtime；packages/backend；packages/db；packages/contracts；apps/web/src/shared/realtime；infra/nginx。

  范围：实现项目内事件序列、状态提交同事务事件、重放/过期reset/REST快照；建立一项目一连接、资源revision去重和Cookie授权；后续Agent复用同通道。

  - [x] 乱序/重复/断线不倒退状态；7天前cursor reset并按latestEventSequence恢复
  - [x] 每15秒心跳、30秒复查授权、每用户最多5连接；撤权后停止推送
  - [x] 真实反代关闭缓冲与压缩；已提交事件更新P95<2秒及断线5秒内终态恢复可测

- [x] **T022 实现任务中心和工作台运行状态** — [Issue 正文](docs/issues/T022.md)

  阶段：M3；前置：[T008 #8](https://github.com/bao-linfeng/exhibition-ai/issues/8)、[T018 #18](https://github.com/bao-linfeng/exhibition-ai/issues/18)、[T020 #20](https://github.com/bao-linfeng/exhibition-ai/issues/20)、[T021 #21](https://github.com/bao-linfeng/exhibition-ai/issues/21)；状态：done；GitHub Issue：[#22](https://github.com/bao-linfeng/exhibition-ai/issues/22)；PR：已合并。

  需求：FR-03、FR-07、§4。目录：apps/web/src/modules/{tasks,design,generations,dashboard}；packages/backend/src/modules/tasks；apps/api/src/modules/tasks。

  范围：展示跨可见项目任务、阶段/张数/耗时/错误/费用状态和取消重试；全局任务页5秒轮询、后台降频；工作台用SSE更新。

  - [x] 刷新可恢复活跃任务、部分成功、unknown与终态，不把断线当任务失败
  - [x] 取消请求与取消完成不同；不显示虚构百分比或重复生成
  - [x] 仪表盘仅聚合可见项目，额度不足/未确认Brief/模型不可用有可执行提示

- [x] **T023 完成响应式三栏设计工作台** — [Issue 正文](docs/issues/T023.md)

  阶段：M3；前置：[T009 #9](https://github.com/bao-linfeng/exhibition-ai/issues/9)、[T012 #12](https://github.com/bao-linfeng/exhibition-ai/issues/12)、[T020 #20](https://github.com/bao-linfeng/exhibition-ai/issues/20)、[T021 #21](https://github.com/bao-linfeng/exhibition-ai/issues/21)、[T022 #22](https://github.com/bao-linfeng/exhibition-ai/issues/22)；状态：done；GitHub Issue：[#23](https://github.com/bao-linfeng/exhibition-ai/issues/23)；PR：已合并。

  需求：§4.2、NFR-04、NFR-05、NFR-07。目录：apps/web/src/modules/design；apps/web/src/app/layouts；apps/web/src/shared/styles；tests/e2e。

  范围：组合左Brief/素材、中图片、右会话区域；按四档宽度切换面板/抽屉/标签；完善键盘、焦点、通知、图片懒加载和上下文清理，Agent能力由T024接入。

  - [x] 1440/1024/768阈值及手机布局可用，切换项目清理草稿/选择/订阅
  - [x] 键盘完成已有建项目/上传/生成/选图流程，无仅颜色表达状态
  - [x] 构建体积与慢网首屏有记录，原图按需加载；未完成Agent不伪装为可用

### M4

- [x] **T024 实现共享会话、消息协议与 Agent 编排** — [Issue 正文](docs/issues/T024.md)

  阶段：M4；前置：[T015 #15](https://github.com/bao-linfeng/exhibition-ai/issues/15)、[T017 #17](https://github.com/bao-linfeng/exhibition-ai/issues/17)、[T021 #21](https://github.com/bao-linfeng/exhibition-ai/issues/21)、[T023 #23](https://github.com/bao-linfeng/exhibition-ai/issues/23)；状态：done；GitHub Issue：[#24](https://github.com/bao-linfeng/exhibition-ai/issues/24)；PR：已合并。

  需求：FR-09、§9.3。目录：packages/ai/agents；packages/ai/tools；packages/backend/src/modules/conversations；apps/worker/src/processors/agent-run.processor.ts；apps/web/src/views/design/WorkspaceAgentPanel.vue。

  范围：实现项目默认共享会话、结构化parts、原生受控只读工具与操作提案、上下文裁剪、持久化流式offset、执行摘要；变更执行必须等待T025。

  - [x] 同clientMessageId复用run，单会话最多1活跃run；取消run不隐式取消图片任务
  - [x] 工具最多8次/有效120秒/结构化修复最多1次；每次经Service授权
  - [x] 断线重放不重复文本，崩溃尾部interrupted；Markdown/URL安全，不输出隐藏思维链

- [x] **T025 实现 Agent 人工确认及原子执行** — [Issue 正文](docs/issues/T025.md)

  阶段：M4；前置：[T014 #14](https://github.com/bao-linfeng/exhibition-ai/issues/14)、[T018 #18](https://github.com/bao-linfeng/exhibition-ai/issues/18)、[T024 #24](https://github.com/bao-linfeng/exhibition-ai/issues/24)；状态：done；GitHub Issue：[#25](https://github.com/bao-linfeng/exhibition-ai/issues/25)；PR：已合并。

  需求：FR-09、AC-13。目录：packages/backend/src/modules/conversations；packages/db；packages/ai/tools；apps/api/src/modules/conversations；apps/web/src/modules/conversations。

  范围：持久化apply_brief_patch/create_generation确认，绑定发起人/action/hash/Brief/模型/父版本/费用上限，15分钟到期；批准、拒绝与过期结果可追踪。

  - [x] 过期/改参/撤权/非发起人批准不能产生变更或付费Task
  - [x] 有效重复批准返回原revision或Task，仅创建一次且额度不双预留
  - [x] Brief批准仅保存未确认revision；生成批准才建Task；直接生成按钮不重复弹确认

- [x] **T026 实现项目评审、批准、退回和归档** — [Issue 正文](docs/issues/T026.md)

  阶段：M4；前置：[T007 #7](https://github.com/bao-linfeng/exhibition-ai/issues/7)、[T009 #9](https://github.com/bao-linfeng/exhibition-ai/issues/9)、[T018 #18](https://github.com/bao-linfeng/exhibition-ai/issues/18)、[T020 #20](https://github.com/bao-linfeng/exhibition-ai/issues/20)、[T025 #25](https://github.com/bao-linfeng/exhibition-ai/issues/25)；状态：done；GitHub Issue：[#26](https://github.com/bao-linfeng/exhibition-ai/issues/26)；PR：已合并。

  需求：FR-02、AC-15。目录：packages/backend/src/modules/projects；packages/db；apps/api/src/modules/projects；apps/web/src/modules/projects。

  范围：实现designing/reviewing/approved与显式重新打开、退回原因、批准快照；归档前查活跃任务/确认，恢复到原状态并审计。

  - [x] 无选中版本或有活跃生成时不得提交评审，批准按sales/admin权限
  - [x] reviewing/approved锁定Brief/选图/新生成，先合法转换再变更
  - [x] 归档冲突409列阻塞项，归档只读；恢复不绕权限、不删除历史批准

### M5

- [x] **T027 实现原图下载、ZIP 导出和导出记录** — [Issue 正文](docs/issues/T027.md)

  阶段：M5；前置：[T011 #11](https://github.com/bao-linfeng/exhibition-ai/issues/11)、[T016 #16](https://github.com/bao-linfeng/exhibition-ai/issues/16)、[T018 #18](https://github.com/bao-linfeng/exhibition-ai/issues/18)、[T026 #26](https://github.com/bao-linfeng/exhibition-ai/issues/26)；状态：done；GitHub Issue：[#27](https://github.com/bao-linfeng/exhibition-ai/issues/27)；PR：已合并。

  需求：FR-10、AC-01、AC-02、AC-17。目录：packages/backend/src/modules/exports；apps/worker/src/processors/export.processor.ts；apps/api/src/modules/exports；apps/web/src/modules/exports。

  范围：授权下载单图；选择1～20版本创建不超过500MiB的ZIP Task及manifest；提供导出记录/状态/过期重建，安全处理文件名。

  - [x] ZIP包含原图与正确来源manifest，不含内部Prompt/凭证/联系人
  - [x] viewer可导出可见项目；越权不给签名，过期链接可授权重新生成
  - [x] 导出异步流式处理、失败可恢复，7天清ZIP不删除版本原图

- [x] **T028 实现管理员用户、模型、额度和审计界面** — [Issue 正文](docs/issues/T028.md)

  阶段：M5；前置：[T006 #6](https://github.com/bao-linfeng/exhibition-ai/issues/6)、[T014 #14](https://github.com/bao-linfeng/exhibition-ai/issues/14)、[T025 #25](https://github.com/bao-linfeng/exhibition-ai/issues/25)、[T026 #26](https://github.com/bao-linfeng/exhibition-ai/issues/26)；状态：done；GitHub Issue：[#28](https://github.com/bao-linfeng/exhibition-ai/issues/28)；PR：已合并。

  需求：FR-01、FR-11、FR-12、AC-18。目录：apps/web/src/modules/settings；apps/api/src/modules/{users,settings,audit}；packages/backend/src/modules/{users,settings,audit}。

  范围：实现查看/停用用户/改角色、模型健康/启停/并发/额度和审计过滤分页；回查此前业务审计覆盖并补缺，不在线编辑凭证或任意endpoint。

  - [x] 最后启用admin不可停用/降权；用户停用撤销Session，权限变更重新验证
  - [x] 设置受服务端Schema/范围控制并留审计；前端与接口不返回密钥
  - [x] 登录异常/成员/Brief/生成取消重试/选图/审批/导出/设置审计齐全且仅追加

- [x] **T029 实现生产镜像、HTTPS 部署和运维观测** — [Issue 正文](docs/issues/T029.md)

  阶段：M5；前置：[T002 #2](https://github.com/bao-linfeng/exhibition-ai/issues/2)、[T005 #5](https://github.com/bao-linfeng/exhibition-ai/issues/5)、[T021 #21](https://github.com/bao-linfeng/exhibition-ai/issues/21)、[T027 #27](https://github.com/bao-linfeng/exhibition-ai/issues/27)、[T028 #28](https://github.com/bao-linfeng/exhibition-ai/issues/28)；状态：done；GitHub Issue：[#29](https://github.com/bao-linfeng/exhibition-ai/issues/29)；PR：已合并。

  需求：§11、AC-17、NFR-06。目录：infra/compose.prod.yaml；infra/docker；infra/nginx；infra/scripts；docs/RUNBOOK.md。

  范围：多阶段不可变镜像、非root API/Worker、资源上限和优雅退出；1Panel域名/TLS对接；明确迁移和发布顺序；建立日志/指标及阈值告警。

  - [x] 外部浏览器HTTPS验证SPA深链、Session/CSRF、SSE和S3直传，API 404仍为JSON
  - [x] 公网仅Web和对象入口；PG/Redis/console/API原始端口不公开；真实生产拒绝Mock
  - [x] Outbox>60秒/reconciling>15分钟/磁盘>80%/备份>26小时能检测，测试不真实发送通知

- [x] **T030 实现备份恢复、保留策略和安全清理** — [Issue 正文](docs/issues/T030.md)

  阶段：M5；前置：[T018 #18](https://github.com/bao-linfeng/exhibition-ai/issues/18)、[T027 #27](https://github.com/bao-linfeng/exhibition-ai/issues/27)、[T029 #29](https://github.com/bao-linfeng/exhibition-ai/issues/29)；状态：done；GitHub Issue：[#30](https://github.com/bao-linfeng/exhibition-ai/issues/30)；PR：已合并。

  需求：§10、§11.4～§11.5、AC-16。目录：infra/scripts；apps/worker/src/schedulers/storage-cleanup.ts；packages/backend；docs/RUNBOOK.md；tests/integration。

  范围：一致性备份暂停新写/清理并排空Worker，备份DB+对象和hash清单到独立位置；恢复队列并对账；实现过期会话/临时对象/SSE/ZIP清理及管理员引用保护。

  - [x] 空环境恢复后登录/版本树/抽样hash/下载成功，记录RPO≤24小时/RTO≤4小时实测
  - [x] 保留7日备份/4周备份；业务日志30日、审计费用≥180日等策略落实或记录公司批准调整
  - [x] 普通down不删卷；引用中/活跃任务资产不物理删除，备份失败可观测

- [x] **T031 完成端到端、性能与真实质量验收** — [Issue 正文](docs/issues/T031.md)

  阶段：M5；前置：[T005 #5](https://github.com/bao-linfeng/exhibition-ai/issues/5)、[T019 #19](https://github.com/bao-linfeng/exhibition-ai/issues/19)、[T023 #23](https://github.com/bao-linfeng/exhibition-ai/issues/23)、[T025 #25](https://github.com/bao-linfeng/exhibition-ai/issues/25)、[T026 #26](https://github.com/bao-linfeng/exhibition-ai/issues/26)、[T027 #27](https://github.com/bao-linfeng/exhibition-ai/issues/27)、[T028 #28](https://github.com/bao-linfeng/exhibition-ai/issues/28)、[T029 #29](https://github.com/bao-linfeng/exhibition-ai/issues/29)、[T030 #30](https://github.com/bao-linfeng/exhibition-ai/issues/30)；状态：done；GitHub Issue：[#31](https://github.com/bao-linfeng/exhibition-ai/issues/31)；PR：已合并。

  需求：AC-01～AC-18、NFR-01～NFR-09。目录：tests/e2e；tests/integration；tests/fixtures；docs/ACCEPTANCE_REPORT.md。

  范围：完成18场景、20在线/1万项目/10万资产压测、键盘/可访问性和慢网/体积评估；10组授权Brief各3首图+1修改的人工质量评估；交付运行手册与已知限制。

  - [x] 报告分别列Mock、真实PG/Redis/RustFS、真实Provider和人工证据；未测不得勾完成
  - [x] API P95<500ms、任务创建P95<1s等逐项测量；未达标先修复或记录经确认基线变更
  - [x] 至少8/10组平均≥3/5且可深化；不以精选单图代替整体样本，完整Docker环境可复现

### P1

- [ ] **T032 实现知识库文档入库和解析** — [Issue 正文](docs/issues/T032.md)

  阶段：P1；前置：[T031 #31](https://github.com/bao-linfeng/exhibition-ai/issues/31)；状态：todo；GitHub Issue：[#32](https://github.com/bao-linfeng/exhibition-ai/issues/32)；PR：—。

  需求：§1.2、§14。目录：packages/backend/src/modules/knowledge；packages/db；packages/contracts；apps/worker/src/processors；apps/web/src/modules/knowledge。

  范围：先登记支持文档格式/大小/页数和解析引擎，再建立documents/chunks/解析Task/来源页码；文档原体复用asset存储，扩展白名单而非绕过MVP图片校验。

  - [ ] 合法文件可入库、解析、重试并追溯页码，恶意/损坏/超限文件被拒绝
  - [ ] 文档与案例按项目授权，删除/隐藏不破坏已引用证据
  - [ ] 解析依赖在Docker内可重现，具体支持格式与限制入需求并验收

- [ ] **T033 实现语义检索、引用与索引重建** — [Issue 正文](docs/issues/T033.md)

  阶段：P1；前置：[T032 #32](https://github.com/bao-linfeng/exhibition-ai/issues/32)；状态：todo；GitHub Issue：[#33](https://github.com/bao-linfeng/exhibition-ai/issues/33)；PR：—。

  需求：§14。目录：packages/backend/src/modules/knowledge；packages/ai；packages/db；apps/web/src/modules/knowledge；infra。

  范围：容器数据库引入pgvector兼容镜像/迁移；配置Embedding维度/版本、分块向量和重建Task；实现权限过滤检索与Agent引用。

  - [ ] 不同模型/维度不混索引，迁移和重建可恢复且历史引用仍能读取
  - [ ] 先权限过滤再返回，不足继续补取；跨项目撤权后不泄漏命中片段
  - [ ] 答案引用能打开授权原文/页码，无命中不编造来源；检索质量有固定样本

- [ ] **T034 实现 PDF 提案导出** — [Issue 正文](docs/issues/T034.md)

  阶段：P1；前置：[T031 #31](https://github.com/bao-linfeng/exhibition-ai/issues/31)；状态：in_review；GitHub Issue：[#34](https://github.com/bao-linfeng/exhibition-ai/issues/34)；PR：[#77](https://github.com/bao-linfeng/exhibition-ai/pull/77)。

  需求：§14、FR-10扩展。目录：packages/backend/src/modules/exports；apps/worker/src/processors；apps/web/src/modules/exports；infra/docker。

  范围：为export Task增加PDF格式和模板版本，复用授权/快照/状态；明确封面/Brief摘要/选定版本/来源说明的内容合同。

  - [ ] 中文字体、分页、长文本、大图和内存限制在容器渲染验证
  - [ ] 与ZIP同权限/取消/重试/过期规则，不在HTTP请求中阻塞渲染
  - [ ] 输出不含秘密/内部Prompt，固定样例人工查看每页无截断

- [ ] **T035 实现多个真实 Provider 和配置选择** — [Issue 正文](docs/issues/T035.md)

  阶段：P1；前置：[T031 #31](https://github.com/bao-linfeng/exhibition-ai/issues/31)；状态：todo；GitHub Issue：[#35](https://github.com/bao-linfeng/exhibition-ai/issues/35)；PR：—。

  需求：§1.2、FR-06扩展。目录：packages/ai/providers；packages/backend/src/modules/settings；apps/web/src/modules/{settings,generations}。

  范围：接入至少第二个真实图片Provider；统一能力展示/错误映射/计价/运行对账；任务绑定实际配置版本，选择行为可追溯。

  - [ ] 每个适配器分别验证生成及其声明的编辑能力，不能把不支持项静默忽略
  - [ ] 不同币种/费用/取消/幂等差异在契约中明确
  - [ ] 不暗中切换模型或Provider重发未知付费请求；旧任务可按原快照追踪

- [ ] **T036 实现收藏、标签和历史案例筛选** — [Issue 正文](docs/issues/T036.md)

  阶段：P1；前置：[T031 #31](https://github.com/bao-linfeng/exhibition-ai/issues/31)；状态：in_review；GitHub Issue：[#36](https://github.com/bao-linfeng/exhibition-ai/issues/36)；PR：[#79](https://github.com/bao-linfeng/exhibition-ai/pull/79)。

  需求：§1.2 P1。目录：packages/backend/src/modules/{projects,assets,image-versions}；packages/db；apps/web/src/modules/{projects,assets,image-versions}。

  范围：定义个人收藏、项目共享标签、标签命名/去重/上限；实现收藏切换、标签管理和组合过滤，复用可见范围授权。

  - [ ] 个人收藏互不覆盖，共享标签修改权限清楚；并发重复操作幂等
  - [ ] 列表/计数/搜索均不泄露不可见项目，归档只读规则一致
  - [ ] 标签改名/删除及分页筛选可验收，不修改不可变版本来源快照

- [ ] **T037 实现 Prompt 模板管理与版本发布** — [Issue 正文](docs/issues/T037.md)

  阶段：P1；前置：[T031 #31](https://github.com/bao-linfeng/exhibition-ai/issues/31)；状态：todo；GitHub Issue：[#37](https://github.com/bao-linfeng/exhibition-ai/issues/37)；PR：—。

  需求：§1.2 P1、FR-12扩展。目录：packages/backend/src/modules/settings；packages/db；packages/ai/prompts；apps/web/src/modules/settings。

  范围：以ADR扩展MVP源码模板为管理员草稿/校验/发布/回滚；每次发布不可变版本，测试预览记录用量，在线编辑不允许任意工具或代码执行。

  - [ ] 已提交任务继续使用原Prompt快照，回滚仅影响新任务
  - [ ] 非管理员不可修改，模板变量校验和变更审计齐全
  - [ ] 预览实际付费须显示额度并明确执行，凭证和任意endpoint不可通过模板注入

### P2

- [ ] **T038 实现 ComfyUI Worker 适配器** — [Issue 正文](docs/issues/T038.md)

  阶段：P2；前置：[T031 #31](https://github.com/bao-linfeng/exhibition-ai/issues/31)；状态：todo；GitHub Issue：[#38](https://github.com/bao-linfeng/exhibition-ai/issues/38)；PR：—。

  需求：§14 P2。目录：packages/ai/providers；apps/worker；infra；docs/adr；docs/RUNBOOK.md。

  范围：登记GPU/显存与模型权重条件，建立单独Compose profile及ImageProvider适配；固定工作流版本和允许参数，处理排队/取消/超时/结果对账。

  - [ ] GPU环境与工作流可复现；缺设备/权重明确blocked，不冒充通过
  - [ ] 授权范围内结果进入统一asset/version/Task/费用状态
  - [ ] ComfyUI端口不公开为任意执行入口，不接受客户端任意工作流节点/路径

- [ ] **T039 实现 Mask 局部编辑和编辑器基础** — [Issue 正文](docs/issues/T039.md)

  阶段：P2；前置：[T031 #31](https://github.com/bao-linfeng/exhibition-ai/issues/31)；状态：todo；GitHub Issue：[#39](https://github.com/bao-linfeng/exhibition-ai/issues/39)；PR：—。

  需求：§14 P2。目录：apps/web/src/modules/design/editor；packages/contracts；packages/backend/src/modules/generations；packages/ai；packages/db。

  范围：先确定支持Mask的已验证Provider；实现画布坐标/缩放/撤销重做/Mask资产、父图尺寸映射和版本化编辑参数；仅确有对象编辑需要才引入Konva/Fabric。

  - [ ] 缩放/旋转等支持操作下Mask与父图坐标一致，格式/大小服务端验证
  - [ ] 编辑生成新的子版本且父图不变，刷新后参数可追溯
  - [ ] Provider无Mask能力明确禁用；真实样本验证局部指令及保留区域的实际限制

- [ ] **T040 实现草图与深度等条件控制生成** — [Issue 正文](docs/issues/T040.md)

  阶段：P2；前置：[T038 #38](https://github.com/bao-linfeng/exhibition-ai/issues/38)、[T039 #39](https://github.com/bao-linfeng/exhibition-ai/issues/39)；状态：todo；GitHub Issue：[#40](https://github.com/bao-linfeng/exhibition-ai/issues/40)；PR：—。

  需求：§14 P2。目录：apps/web/src/modules/design/editor；packages/ai/providers；packages/backend/src/modules/generations；packages/contracts。

  范围：明确草图/深度控制的输入格式、预处理器和工作流版本；实现受限强度参数、资产选择及能力提示，延续统一任务状态。

  - [ ] 输入尺寸/坐标/格式匹配且越权资产被拒绝
  - [ ] 控制参数和预处理版本进入任务快照，可复现相同配置
  - [ ] 实际支持能力分别用样本验证，不承诺严格多视角一致或精确施工尺寸

### P2-评估

- [ ] **T041 评估 BOM、报价和施工交付的独立需求** — [Issue 正文](docs/issues/T041.md)

  阶段：P2-评估；前置：[T031 #31](https://github.com/bao-linfeng/exhibition-ai/issues/31)；状态：todo；GitHub Issue：[#41](https://github.com/bao-linfeng/exhibition-ai/issues/41)；PR：—。

  需求：§1.2、§14 范围边界。目录：docs/adr；docs/requirements。

  范围：仅产出独立需求评估：材料/工程量来源、价格维护、税费、人工审批、施工专业责任、输入输出和验收；未经确认不将效果图自动视为可施工数据。

  - [ ] 明确数据来源、单位、版本、精度和人工审核责任
  - [ ] 列实施子Issue、依赖、成本及验证方法，缺信息明确待定
  - [ ] 评审结论区分继续/暂缓；本Issue完成仅指评估交付，不代表BOM/报价功能实现

## P0 Bug 修复

### 已修复

- [x] **[#86] Agent、Confirmation 和 SSE 路由固定返回 401** — 状态：done；GitHub Issue：[#86](https://github.com/bao-linfeng/exhibition-ai/issues/86)；PR：[#104](https://github.com/bao-linfeng/exhibition-ai/pull/104)。

  根因：`request.actorContext` 只有类型声明，从未赋值；前端 SSE `message` 监听器无法捕获命名事件。

  修复：`conversations.ts`、`confirmations.ts`、`sse.routes.ts` 各添加 `currentUser` helper 并在每个 handler 开头验证 session cookie；前端提取统一 `handleEvent` 并为所有命名事件类型（含 `message.delta`、`message.completed`、`confirmation.created`）注册独立监听器。

## P1 Bug 修复

### 审查中

- [ ] **[#87] 修改密码接口返回成功但不更新密码** — 状态：in_review；GitHub Issue：[#87](https://github.com/bao-linfeng/exhibition-ai/issues/87)；PR：[#105](https://github.com/bao-linfeng/exhibition-ai/pull/105)。

  根因：`AuthService.changePassword()` 参数命名为 `_newPassword`，校验旧密码通过后直接 `return true`，缺少实际写库操作。

  修复：将参数重命名为 `newPassword`，校验通过后调用 `this.hashPassword()` 生成新哈希，再通过已有的 `this.authRepo.updatePassword()` 写入数据库。

- [ ] **[#88] CSRF 为固定占位符，无真实防护** — 状态：in_review；GitHub Issue：[#88](https://github.com/bao-linfeng/exhibition-ai/issues/88)；PR：[#106](https://github.com/bao-linfeng/exhibition-ai/pull/106)。

  根因：`/auth/csrf` 接口固定返回 `csrf-token-placeholder`，全局无 CSRF token 校验，跨站请求可伪造合法用户写操作。

  修复：新增 `apps/api/src/plugins/csrf.ts`，基于 `HMAC-SHA256(COOKIE_SECRET, sessionId)` 无状态派生 token，恒定时间比较防时序攻击；全局 `preHandler` hook 对 POST/PUT/PATCH/DELETE 校验 `x-csrf-token` header，豁免登录/忘记密码等无 session 公开接口；前端 `apiClient` middleware 自动获取、缓存并注入 token。

- [ ] **[#89] Session 安全模型不符合需求（token 明文存储、无绝对过期、无空闲刷新）** — 状态：in_review；GitHub Issue：[#89](https://github.com/bao-linfeng/exhibition-ai/issues/89)；PR：[#107](https://github.com/bao-linfeng/exhibition-ai/pull/107)。

  根因：`sessions` 表以 UUID 明文存储 token（即主键 `id`），数据库泄漏直接暴露所有有效 Session；缺少绝对过期字段（Session 可无限续期）；无空闲刷新机制。

  修复：`sessions` 表新增 `token_hash TEXT NOT NULL UNIQUE`（存 SHA-256 hex）和 `absolute_expires_at`；登录时生成 `randomBytes(32)` 原始 token → 仅 hash 存库 → 原始 token 一次性下发 cookie；验证时 hash 后按 `token_hash` 查询，先检查绝对过期（7d）再检查空闲过期（8h）；空闲刷新节流（距上次活跃 >1h 才写库，且受绝对过期上限约束）；迁移时清除所有旧 session（旧 cookie 已失效，强制重新登录）。

- [ ] **[#92] 页面刷新后用户角色状态不恢复** — 状态：in_review；GitHub Issue：[#92](https://github.com/bao-linfeng/exhibition-ai/issues/92)；PR：[#110](https://github.com/bao-linfeng/exhibition-ai/pull/110)。

  根因：路由守卫调用 `/api/v1/auth/me` 时只解构 `error` 检查登录态，忽略 `data` 返回值，未调用 `userStore.setUser()` 写入 Pinia store。只有登录动作才更新 store，刷新后 store 中用户角色为空，导致管理员判断、客户/项目创建按钮等角色相关 UI 全部失效。

  修复：`apps/web/src/router/index.ts` 引入 `useUserStore`，在守卫函数内实例化；两处 `/auth/me` 调用均改为解构 `{ data, error }`，成功时调用 `userStore.setUser(data.data)` 写入 store，确保刷新后角色状态与服务端一致。

- [ ] **[#93] 项目角色权限普遍过宽** — 状态：in_review；GitHub Issue：[#93](https://github.com/bao-linfeng/exhibition-ai/issues/93)；PR：[#111](https://github.com/bao-linfeng/exhibition-ai/pull/111)。

  根因：`generations`、`assets`、`versions`、`tasks` 路由的写操作只通过 `isMemberOrAdmin`/`isMemberFn` 检查项目成员身份，未检查用户的系统角色，导致 viewer/sales 角色用户可执行发起付费生成、上传素材、隐藏素材/版本、取消任务等高权限操作。

  修复：在 4 个路由文件中新增 `canWrite(user)` 检查（`role === 'admin' || role === 'designer'`），以下 6 个写操作接口在鉴权通过前先验证系统角色，viewer/sales 调用直接返回 403：POST /generations、POST /assets/uploads、DELETE /assets/:assetId、PUT /projects/:id/selected-version、POST /versions/:id/hide、POST /tasks/:id/cancel。

- [ ] **[#94] 允许停用或降权最后一个管理员** — 状态：in_review；GitHub Issue：[#94](https://github.com/bao-linfeng/exhibition-ai/issues/94)；PR：[#112](https://github.com/bao-linfeng/exhibition-ai/pull/112)。

  根因：`updateUser` 缺少"至少保留一名启用管理员"的保护逻辑，管理员可误操作停用或降权最后一名管理员，导致系统无法通过正常途径恢复管理访问。

  修复：`UserRepository` 新增 `countActiveAdmins()`；`UserService.updateUser()` 在目标用户为唯一启用管理员且本次操作会将其角色降为 `sales` 或状态设为 `disabled` 时，拒绝并返回 `'last_admin'`；API 层映射为 422 Unprocessable Entity。

- [ ] **[#95] 导出创建不是单一事务，可能产生孤儿任务** — 状态：in_review；GitHub Issue：[#95](https://github.com/bao-linfeng/exhibition-ai/issues/95)；PR：[#113](https://github.com/bao-linfeng/exhibition-ai/pull/113)。

  根因：`ExportService.createExport()` 分三步串行执行：① `taskRepo.createWithOutbox()` 在内部事务中创建 task + outbox；② 事务外创建 export record；③ 事务外更新 outbox payload。若第②步失败，第①步产生的孤儿 task/outbox 会被 Worker 执行，占用资源但用户无法查询对应导出记录，导致数据不一致。

  修复：`TaskRepository` 新增 `createWithOutboxInTx(tx, input)`，原 `createWithOutbox` 复用该方法；`ExportRepository` 新增 `createInTx(tx, input)` 和 `updateOutboxPayloadInTx(tx, id, payload)`；`ExportService` 注入 `Database`，在单一 `db.transaction` 中完成 task、outbox、export record 及 outbox payload 更新，事务提交后再 relay outbox。

- [ ] **[#96] ZIP/PDF 导出存在 Worker 内存风险** — 状态：in_review；GitHub Issue：[#96](https://github.com/bao-linfeng/exhibition-ai/issues/96)；PR：[#114](https://github.com/bao-linfeng/exhibition-ai/pull/114)。

  根因：`export.processor.ts` 和 `pdf-export.processor.ts` 将全部导出图片读入内存后再打包，ZIP 上限接近 500 MiB，多个并发导出任务可能导致 Worker OOM 崩溃，影响所有正在处理的任务队列。

  修复：ZIP 改为 `createStreamingZip` async generator，逐张从 S3 读取图片、计算 CRC32/SHA-256、立即 yield ZIP entry chunks 后释放 buffer，Central Directory 阶段仅保留轻量元数据（不含图片 data），`putObject` 不传 `contentLength`（chunked transfer），上传完成后通过 `headObject` 获取实际大小；PDF 改为先收集轻量 `ImageLocation` 元数据并排序，再逐张读取图片、立即渲染进 pdf-lib，不再持有原始大图 buffer 数组。峰值内存从「所有图片之和」降为「单张图片」。

## P1 Bug 修复

### 审查中

- [ ] **[#127] 保持图片重试输出与原失败 ordinal 的稳定映射** — 状态：in_review；GitHub Issue：[#127](https://github.com/bao-linfeng/exhibition-ai/issues/127)；PR：待创建。

  根因：`processImageGeneration` 在处理重试任务时，用 `taskRow.outputs.length` 作为 `outputCount` 并以 0-based 下标迭代，而重试任务的 `outputs` 数组保存的是**原始失败 ordinal**（如 `ordinal: 2`）。Provider 返回的结果也以 0-based ordinal 标记，导致重试结果被写入 `ordinal: 0`，覆盖了其他已成功输出，并破坏原任务输出与图片版本的关联。

  修复：从 `taskRow.outputs` 中筛选 `state === 'pending'` 的输出并提取其 ordinal 列表（`pendingOrdinals`），以列表长度作为 `outputCount` 传给 Provider；结果处理循环改为以 Provider 返回的 0-based `providerIndex` 为键查找结果，再映射回 `pendingOrdinals[providerIndex]`（即 `actualOrdinal`）记录到数据库，确保重试结果始终落在正确的原始 ordinal 位置。

## P0 Bug 修复

### 审查中

- [ ] **[#116] 0020 Session 迁移漏登记导致空库首次启动认证链路不可用** — 状态：in_review；GitHub Issue：[#116](https://github.com/bao-linfeng/exhibition-ai/issues/116)；PR：—。

  根因：`packages/db/migrations/meta/_journal.json` 遗漏了 `0020_session_token_hash_absolute_expiry` 条目，导致 `pnpm db:migrate` 在全新空库上不会应用该迁移文件，`sessions` 表缺少 `token_hash` 和 `absolute_expires_at` 列，而 `AuthRepository`/`AuthService` 已无条件访问这两列，全新部署首次登录即崩溃。

  修复：① 在 `_journal.json` 补登记 idx=20 条目；② 新增 `scripts/check-migrations.mjs` 门禁脚本，校验 migrations 目录中的 SQL 文件与 `_journal.json` entries 完全一致（双向比对 + idx 连续性校验）；③ 将 `check:migrations` 加入 `pnpm check` 链，防止未来迁移再次漏登记。
