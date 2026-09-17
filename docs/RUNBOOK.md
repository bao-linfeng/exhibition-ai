# Exhibition AI — 运维手册（RUNBOOK）

> 适用范围：生产环境运维、备份恢复、保留策略、告警处理。  
> 最后更新：2026-09-17（T030 初版）

---

## 目录

1. [服务架构概览](#1-服务架构概览)
2. [常用运维命令](#2-常用运维命令)
3. [数据保留策略](#3-数据保留策略)
4. [备份操作手册](#4-备份操作手册)
5. [恢复操作手册](#5-恢复操作手册)
6. [告警处理](#6-告警处理)
7. [引用保护与安全清理](#7-引用保护与安全清理)
8. [安全注意事项](#8-安全注意事项)

---

## 1. 服务架构概览

```
postgres  ←─ API / Worker 读写
redis     ←─ BullMQ 任务队列
rustfs    ←─ 对象存储（兼容 S3）
api       ←─ Fastify 5 REST API
worker    ←─ BullMQ 消费者 + 定时任务
web       ←─ Vite SPA 静态前端
nginx     ←─ 反向代理（生产）
```

所有服务由 Docker Compose 管理。**生产 compose 文件**：`infra/compose.prod.yaml`。

---

## 2. 常用运维命令

所有命令从项目根目录运行。

```bash
# 查看服务状态
docker compose --env-file .env -f infra/compose.dev.yaml ps

# 查看日志
docker compose --env-file .env -f infra/compose.dev.yaml logs --tail 100 api worker

# 重启单个服务
docker compose --env-file .env -f infra/compose.dev.yaml restart api

# 停止（保留数据卷）
docker compose --env-file .env -f infra/compose.dev.yaml down

# ⚠️ 禁止：以下命令会销毁所有数据！
# docker compose down -v   ← 严禁在生产环境执行
```

---

## 3. 数据保留策略

> 保留策略由公司运维决策确定，记录于本文档（§11.5 / AC-16）。

| 数据类型       | 保留时长                | 说明                                                     |
| -------------- | ----------------------- | -------------------------------------------------------- |
| 备份（日备份） | 7 份                    | 滚动保留最近 7 个日备份                                  |
| 备份（周备份） | 4 份                    | 每周日自动触发，保留最近 4 个                            |
| 业务操作日志   | 30 天                   | 普通操作日志，`project_events` 表                        |
| 审计日志       | ≥ 180 天                | `audit_logs` 表，含用户操作、权限变更、费用流水          |
| 费用账本       | ≥ 180 天                | `usage_ledger` 表                                        |
| SSE 事件       | 7 天（评估中）          | `project_events` 表，目前无自动清理，由 DBA 手动归档     |
| 临时上传对象   | 24 小时                 | 状态为 `initiated` 的 `upload_sessions`，Worker 自动清理 |
| ZIP 导出文件   | 7 天                    | `export_records` 到期后 Worker 自动清理 S3 对象          |
| 过期会话       | 由 `expiresAt` 字段控制 | `sessions` 表，登录时自动判断，无需主动清理              |

### 重要约束

- **普通 `docker compose down` 不得带 `-v` 参数**——该操作会销毁 postgres_data、redis_data、rustfs_data 卷。
- **引用保护**：被活跃任务、项目图片版本树引用的资产对象**严禁物理删除**。
- **审计与费用记录**是不可变追加日志，严禁 `DELETE` 操作，如有业务需要通过软删/归档处理。

---

## 4. 备份操作手册

### 4.1 手动执行备份

```bash
# 从项目根目录执行
BACKUP_DIR=/data/backups bash infra/scripts/backup.sh
```

备份输出目录结构：

```
/data/backups/
  daily/
    backup_20260917_020000/
      postgres.dump       ← PostgreSQL 自定义格式 dump
      objects/            ← RustFS/S3 对象镜像（需要 mc 或 aws-cli）
      SHA256SUMS          ← 所有文件的 SHA-256 校验清单
  weekly/
    backup_20260914_020000 -> ../daily/backup_20260914_020000  ← 软链接
```

### 4.2 自动备份（生产推荐）

在宿主机 crontab 添加：

```cron
# 每天凌晨 2:00 执行备份
0 2 * * * cd /path/to/exhibition-ai && BACKUP_DIR=/data/backups bash infra/scripts/backup.sh >> /var/log/exhibition-backup.log 2>&1
```

### 4.3 验证备份完整性

```bash
cd /data/backups/daily/backup_20260917_020000
sha256sum --check SHA256SUMS
```

### 4.4 备份前置条件

- `mc`（MinIO Client）或 `aws-cli` 已安装并在 PATH
- `BACKUP_DIR` 目录有足够磁盘空间（建议至少 2x 数据库大小）
- `.env` 文件中 `S3_ACCESS_KEY`、`S3_SECRET_KEY`、`S3_ENDPOINT`、`S3_BUCKET` 已正确配置

### 4.5 RPO 目标

**RPO ≤ 24 小时**：每日凌晨自动备份，最坏情况丢失不超过 24 小时数据。

---

## 5. 恢复操作手册

### 5.1 执行恢复

```bash
# 从项目根目录执行，指定备份路径
bash infra/scripts/restore.sh /data/backups/daily/backup_20260917_020000
```

### 5.2 恢复流程说明

1. **SHA-256 校验**：验证备份文件完整性
2. **停止服务**：自动停止 api 和 worker，避免写入冲突
3. **恢复 PostgreSQL**：删除并重建数据库，从 dump 文件恢复
4. **恢复对象存储**：将备份的 objects/ 镜像回 RustFS/S3
5. **运行迁移**：确保数据库 schema 与当前代码一致
6. **重启服务**：启动 api 和 worker，等待健康检查通过

### 5.3 恢复后验收清单

恢复完成后**必须**手动执行以下验收项并记录结果：

```
□ 使用管理员账号登录系统，确认认证正常
□ 打开至少一个项目，确认项目列表和版本树完整显示
□ 从版本树中选择至少 3 个图片版本，下载并比对 SHA-256 哈希
□ 确认 Worker 日志中出现心跳消息（无错误）
□ 执行一次测试导出，验证 ZIP 生成和下载正常
□ 记录恢复开始时间和完成时间（计算 RTO 实测值）
```

**RTO 目标**：≤ 4 小时（从决定恢复到系统完全可用）

### 5.4 恢复验证命令

```bash
# 查看服务健康
curl http://localhost:3000/api/health
curl http://localhost:3000/api/ready

# 查看 Worker 心跳（容器内）
docker compose --env-file .env -f infra/compose.dev.yaml exec worker cat /tmp/exhibition-worker-health

# 查看最近日志
docker compose --env-file .env -f infra/compose.dev.yaml logs --tail 50 api worker
```

### 5.5 恢复前注意事项

- **生产数据会被覆盖**，执行前确认已取得运维负责人批准
- 确认当前运行的 api/worker 已无活跃任务（检查 tasks 表中 running/queued 状态数量）
- 备份目录路径必须是绝对路径

---

## 6. 告警处理

通过 `bash infra/scripts/check-alerts.sh` 检测以下告警。

| 告警             | 条件                                   | 处理方式                    |
| ---------------- | -------------------------------------- | --------------------------- |
| Outbox 积压      | `tasks` pending 超过 60 秒             | 检查 Worker 是否正常运行    |
| Reconciling 超时 | tasks running/reconciling 超过 15 分钟 | 手动触发调和或重启 Worker   |
| 磁盘使用率高     | 磁盘使用 > 80%                         | 清理旧备份、归档日志        |
| 备份超时         | 上次备份超过 26 小时                   | 检查 crontab 和备份脚本日志 |

### 备份超时处理

```bash
# 检查上次备份时间
cat /tmp/last-backup-time | xargs -I{} date -d @{}

# 手动触发备份
BACKUP_DIR=/data/backups bash infra/scripts/backup.sh

# 检查备份日志
tail -100 /var/log/exhibition-backup.log
```

---

## 7. 引用保护与安全清理

### 7.1 Worker 自动清理规则

Worker 每小时运行一次 `runStorageCleanup`，执行以下清理：

1. **过期临时上传**（`upload_sessions`）：`initiated` 状态超过 24 小时的会话及其 S3 对象将被删除
2. **过期 ZIP 导出**（`export_records`）：`expiresAt` 已过且有关联资产的 S3 对象将被删除

### 7.2 引用保护规则

以下对象**不会被自动清理**：

- 状态为 `ready` 的资产（关联项目图片版本树）
- 活跃任务（`running`、`queued`、`awaiting_confirmation`）中引用的对象
- 项目选定版本（`selected_version_id`）关联的资产
- 已批准项目（`approved_snapshot`）中记录的资产

### 7.3 手动清理操作

如需手动清理孤立对象，**必须**先查询确认无引用后再操作：

```sql
-- 查找 initiated 状态超过 24 小时的上传会话
SELECT id, object_key, expires_at
FROM upload_sessions
WHERE status = 'initiated'
  AND expires_at < NOW() - INTERVAL '24 hours';

-- 查找已过期的 ZIP 导出记录
SELECT id, result_asset_id, expires_at
FROM export_records
WHERE expires_at < NOW()
  AND result_asset_id IS NOT NULL;
```

---

## 8. 安全注意事项

1. **严禁**在生产环境使用 `docker compose down -v`
2. **严禁**直接 `DELETE FROM assets` 或 `DELETE FROM image_versions`，应通过 API 的 hide 接口操作
3. **审计日志**（`audit_logs`、`usage_ledger`）为只增表，严禁删除
4. 备份目录需设置适当权限（仅运维账号可读），避免备份文件泄露数据库凭据
5. `S3_ACCESS_KEY` / `S3_SECRET_KEY` 等凭据不得写入备份清单
