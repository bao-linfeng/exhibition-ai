# M5 端到端验收报告（Issue #31）

## 执行摘要

当前交付提供 AC-01～AC-18 与可自动化 NFR 的验收测试骨架及可复现命令。Mock 阶段的测试可在已启动的 Docker Compose 环境、提供隔离夹具和 E2E 凭据后机器验证。真实 Provider 验收尚待执行并记录证据，不能以 Mock 结果替代。

**整体验收状态：Mock 阶段待执行；真实 Provider 待验。**

## 验收环境说明

- Docker Compose 开发环境：PostgreSQL（含 pgvector）、Redis、RustFS、API、Worker、Web。
- 测试运行时设定 `AI_PROVIDER_MODE=mock`；E2E 测试还会在 `before` 钩子内设定该变量。
- E2E 使用 `API_BASE_URL`（默认 `http://localhost:3000`）通过 HTTP `fetch` 访问 API。
- 无运行 API、`SKIP_E2E=1` 或缺少指定的隔离夹具时，E2E 用例会显式 skip，不会将未执行误报为通过。

## AC 验收状态

| 场景描述                             | 测试文件                                     | Mock 结果          | 真实 PG/Redis 结果 | 真实 Provider 结果 | 人工证据                 |
| ------------------------------------ | -------------------------------------------- | ------------------ | ------------------ | ------------------ | ------------------------ |
| AC-01 完整设计、三图、选图与溯源     | `tests/e2e/ac01-full-design-flow.test.ts`    | 待执行（机器验证） | 待执行             | 待手动验证         | 原图/ZIP/版本树截图      |
| AC-02 非成员资源及创建权限           | `tests/e2e/ac02-access-control.test.ts`      | 待执行（机器验证） | 待执行             | 不适用             | 403/404 与 audit 记录    |
| AC-03 Idempotency-Key 重放与冲突     | `tests/e2e/ac03-idempotency.test.ts`         | 待执行（机器验证） | 待执行             | 不适用             | taskId 对照              |
| AC-04 排队后 Brief 修订隔离          | `tests/e2e/ac04-brief-modify-queued.test.ts` | 待执行（机器验证） | 待执行             | 待手动验证         | 输入快照与 revision      |
| AC-05 Outbox、Redis 暂停恢复         | `tests/e2e/ac05-outbox-recovery.test.ts`     | 待执行（机器验证） | 待执行             | 不适用             | Outbox/Worker 日志       |
| AC-06 Provider 超时及对账            | `tests/e2e/ac06-provider-reconcile.test.ts`  | 待执行（机器验证） | 待执行             | 待手动验证         | requestId、调用次数      |
| AC-07 两成功一失败                   | `tests/e2e/ac07-partial-failure.test.ts`     | 待执行（机器验证） | 待执行             | 待手动验证         | 输出与版本序列           |
| AC-08 queued/running 并发取消 CAS    | `tests/e2e/ac08-cancel-cas.test.ts`          | 待执行（机器验证） | 待执行             | 不适用             | 状态转换日志             |
| AC-09 并发选图、版本树               | `tests/e2e/ac09-concurrent-select.test.ts`   | 待执行（机器验证） | 待执行             | 不适用             | 409 及树形截图           |
| AC-10 SSE 重连、cursor、移除成员     | `tests/e2e/ac10-sse-reconnect.test.ts`       | 待执行（机器验证） | 待执行             | 不适用             | SSE 抓包                 |
| AC-11 MIME、尺寸、complete 校验      | `tests/e2e/ac11-asset-validation.test.ts`    | 待执行（机器验证） | 待执行             | 不适用             | RustFS 对象核查          |
| AC-12 V1 分叉和旧图选择              | `tests/e2e/ac12-version-tree.test.ts`        | 待执行（机器验证） | 待执行             | 不适用             | 完整版本树               |
| AC-13 Agent confirmation             | `tests/e2e/ac13-agent-confirmation.test.ts`  | 待执行（机器验证） | 待执行             | 待手动验证         | confirmation/task 对照   |
| AC-14 并发修改及可取消修改           | `tests/e2e/ac14-concurrent-modify.test.ts`   | 待执行（机器验证） | 待执行             | 不适用             | 原子冲突记录             |
| AC-15 reviewed/approved/archive 限制 | `tests/e2e/ac15-project-lifecycle.test.ts`   | 待执行（机器验证） | 待执行             | 不适用             | 状态机记录               |
| AC-16 PG 备份恢复                    | `tests/e2e/ac16-backup-restore.test.ts`      | 待执行（机器验证） | 待手动执行 RUNBOOK | 不适用             | migration、hash、health  |
| AC-17 生产 HTTPS 全链路              | `tests/e2e/ac17-https-flow.test.ts`          | 不适用             | 待部署验证         | 待手动验证         | TLS/Cookie/CORS/SSE 证据 |
| AC-18 模型、失败与额度验证           | `tests/e2e/ac18-model-validation.test.ts`    | 待执行（机器验证） | 待执行             | 待手动验证         | 模型配置及账号隔离       |

## NFR 性能与质量指标

| 指标                      | 目标                | Mock 测量值                          | 备注                                |
| ------------------------- | ------------------- | ------------------------------------ | ----------------------------------- |
| NFR-01 20 并发 API P95    | <500ms              | 待执行（`nfr01-performance`）        | 生产需以 1 万项目/10 万资产压测复核 |
| NFR-02 创建任务 P95       | <1s                 | 待执行（`nfr02-task-creation-perf`） | 断言立即返回 taskId                 |
| NFR-03 UI 反馈 P95        | <2s                 | 待人工测量                           | Web 端到端证据待补                  |
| NFR-04 关键 JS 资源       | <500KiB             | 待构建分析                           | 图片不计入                          |
| NFR-05 10Mbps/50ms 可交互 | <3s                 | 待人工测量                           | 使用浏览器网络节流                  |
| NFR-06 权限与审计         | 范围权限、无 Secret | 待执行（`nfr06-audit-security`）     | 越权审计仍需端到端复核              |
| NFR-07 键盘与 WCAG AA     | 达标目标            | 待人工验收                           | 需要辅助技术证据                    |
| NFR-08 Worker 重启幂等    | 不重复执行          | 待执行（`nfr08-worker-idempotency`） | 需补 Worker 重启实测日志            |
| NFR-09 10 组 Brief 质量   | 记录平均维度        | 待人工评估                           | 真 Provider 必做                    |

## 质量评估记录

对 **10 组已获授权的 Brief**，每组生成 3 张首图并各进行 1 次修改。每张图按 1～5 分填写并记录平均值：

| Brief 编号 | 首图/修改 | 需求贴合 | 品牌一致 | 空间可实现性 | 视觉质量 | 修改遵循 | 平均分 | 评审人/证据 |
| ---------- | --------- | -------- | -------- | ------------ | -------- | -------- | ------ | ----------- |
| 01～10     | 各 3+1    | 待填写   | 待填写   | 待填写       | 待填写   | 待填写   | 待填写 | 待填写      |

## 已知限制

1. 真实 Provider 的超时盲区、`requestId` 追踪、真实费用/限额、输出质量和账号隔离不能由 Mock 覆盖。
2. HTTPS、S3 公网签名 Host/CORS、Cookie `Secure` 属性需要部署到正式入口后验收。
3. 备份恢复、生产数据规模性能、弱网可交互性、无障碍和人工质量评分需由运行手册及人工测试补证。
4. E2E 用例依赖环境变量提供的**一次性隔离夹具**；没有夹具时会 skip，而非声称通过。

## 运行命令

```sh
docker compose --env-file .env -f infra/compose.dev.yaml up -d postgres redis rustfs api worker web
docker compose --env-file .env -f infra/compose.dev.yaml run --rm devtools pnpm check
docker compose --env-file .env -f infra/compose.dev.yaml run --rm devtools node --import tsx --conditions=development --test tests/integration/nfr*.test.ts
docker compose --env-file .env -f infra/compose.dev.yaml run --rm -e API_BASE_URL=http://api:3000 -e AI_PROVIDER_MODE=mock -e E2E_DESIGNER_EMAIL=... -e E2E_DESIGNER_PASSWORD=... -e E2E_VIEWER_EMAIL=... -e E2E_VIEWER_PASSWORD=... -e E2E_ADMIN_EMAIL=... -e E2E_ADMIN_PASSWORD=... devtools node --import tsx --conditions=development --test tests/e2e/*.test.ts
```

设置 `SKIP_E2E=1` 可在没有运行中 API 的静态检查阶段显式跳过 E2E：

```sh
docker compose --env-file .env -f infra/compose.dev.yaml run --rm -e SKIP_E2E=1 devtools node --import tsx --conditions=development --test tests/e2e/*.test.ts
```

## 结论

代码库已具备 Mock 可机器验证的验收入口和报告模板，但**尚未完成一次有证据的验收执行**。上线前必须在真实 PG/Redis、正式 HTTPS/S3 与真实 Provider 环境运行对应测试，补齐上述表格的实测值、Provider `requestId`、备份恢复记录、性能压测和人工质量/无障碍证据。
