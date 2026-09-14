# 展台 AI 设计平台 - 数据库 ER 图

本文档展示项目的完整数据库表结构和实体关系图。

## 核心领域模型

### 用户与认证域
- users: 用户账号、角色、状态
- sessions: 会话管理

### 客户与项目域
- customers: 客户信息
- projects: 项目主表
- project_members: 项目成员关系
- project_reviews: 审批记录
- project_events: 项目事件流（SSE）

### 需求与设计域
- brief_revisions: 需求快照（不可变）
- design_directions: 设计方向候选

### 资产与存储域
- upload_sessions: 上传会话
- assets: 资产元数据

### 任务与执行域
- tasks: 任务主表（业务真源）
- task_inputs: 任务输入关联
- task_outputs: 输出单元
- task_attempts: 执行尝试
- generation_batches: 图片生成批次

### 版本域
- image_versions: 图片版本树

### 对话与 Agent 域
- conversations: 会话
- messages: 消息
- agent_runs: Agent 运行
- confirmations: 人工确认
- tool_executions: 工具执行记录

### 配置与审计域
- model_configs: 模型配置
- prompt_versions: Prompt 版本
- usage_ledger: 用量与费用账本
- quota_limits: 额度限制
- audit_logs: 审计日志

### 导出域
- export_items: 导出项

### 基础设施域
- idempotency_keys: 幂等键
- outbox_events: Outbox 事件

## 完整 ER 图

```mermaid
erDiagram
    %% ===== 用户与认证域 =====
    users {
        uuid id PK
        string email UK "规范化唯一"
        string display_name
        string password_hash
        enum role "admin/designer/sales/viewer"
        enum status "active/disabled"
        boolean must_change_password
        integer revision
        timestamptz created_at
        timestamptz updated_at
    }
    
    sessions {
        uuid id PK
        string token_hash UK
        uuid user_id FK
        timestamptz last_seen_at
        timestamptz expires_at
        timestamptz absolute_expires_at
        timestamptz revoked_at
        timestamptz created_at
    }
    
    %% ===== 客户与项目域 =====
    customers {
        uuid id PK
        string name
        string contact_name
        string contact_phone
        string contact_email
        uuid created_by FK
        enum status "active/disabled"
        integer revision
        timestamptz created_at
        timestamptz updated_at
    }
    
    projects {
        uuid id PK
        uuid customer_id FK
        uuid owner_id FK "负责人"
        string name
        string exhibition_name
        string venue
        date exhibition_date
        date delivery_deadline
        string industry
        text notes
        enum status "draft/briefing/designing/reviewing/approved"
        enum archived_from_status
        uuid current_brief_revision_id FK
        uuid selected_version_id FK
        integer next_version_sequence
        integer next_event_sequence
        integer revision
        timestamptz created_at
        timestamptz updated_at
    }
    
    project_members {
        uuid id PK
        uuid project_id FK
        uuid user_id FK
        uuid added_by FK
        timestamptz created_at
    }
    
    project_reviews {
        uuid id PK
        uuid project_id FK
        uuid version_id FK
        uuid brief_revision_id FK
        enum action "approve/request_changes/reopen"
        text comment
        uuid actor_id FK
        timestamptz created_at
    }
    
    project_events {
        uuid id PK
        uuid project_id FK
        integer sequence UK "项目内单调"
        string event_type
        uuid resource_id
        integer resource_revision
        jsonb payload
        timestamptz occurred_at
    }
    
    %% ===== 需求与设计域 =====
    brief_revisions {
        uuid id PK
        uuid project_id FK
        integer number UK "项目内版本号"
        jsonb content "不可变快照"
        uuid created_by FK
        uuid confirmed_by FK
        timestamptz confirmed_at
        timestamptz created_at
    }
    
    design_directions {
        uuid id PK
        uuid project_id FK
        uuid brief_revision_id FK
        uuid source_task_id FK
        string title
        jsonb content
        uuid created_by FK
        timestamptz created_at
    }
    
    %% ===== 资产域 =====
    upload_sessions {
        uuid id PK
        uuid project_id FK
        uuid user_id FK
        string temp_key UK
        bigint expected_size
        string expected_type
        timestamptz expires_at
        uuid asset_id FK
        enum status "initiated/validating/completed/failed/expired"
        timestamptz created_at
    }
    
    assets {
        uuid id PK
        uuid project_id FK
        enum kind "logo/product/reference/brand_material/generated/thumbnail/export"
        enum status "pending/validating/ready/rejected"
        string bucket
        string object_key UK "bucket+key唯一"
        string original_filename
        string mime_type
        bigint size_bytes
        integer width
        integer height
        string sha256
        uuid source_asset_id FK "缩略图关联原图"
        uuid hidden_at
        uuid created_by FK
        timestamptz created_at
        timestamptz updated_at
    }
    
    %% ===== 任务域 =====
    tasks {
        uuid id PK
        uuid project_id FK
        enum kind "brief_parse/design_direction/image_generation/asset_validation/agent_run/export"
        string subtype
        enum status "pending/queued/running/succeeded/partially_succeeded/failed/cancelled/awaiting_confirmation/reconciling"
        string stage
        decimal progress
        integer revision
        jsonb input_snapshot "不可变"
        jsonb result_snapshot
        uuid retry_of_task_id FK
        jsonb retry_output_mapping
        uuid requested_by FK
        timestamptz cancel_requested_at
        timestamptz started_at
        timestamptz finished_at
        string error_code
        text error_detail
        timestamptz created_at
        timestamptz updated_at
    }
    
    task_inputs {
        uuid id PK
        uuid task_id FK
        uuid asset_id FK
        enum role "logo/reference/parent_image/document"
        integer ordinal
        timestamptz created_at
    }
    
    task_outputs {
        uuid id PK
        uuid task_id FK
        integer ordinal UK "task内唯一"
        enum state "pending/running/succeeded/failed/reconciling/cancelled"
        uuid asset_id FK
        uuid version_id FK
        uuid active_attempt_id FK
        timestamptz created_at
        timestamptz updated_at
    }
    
    task_attempts {
        uuid id PK
        uuid task_id FK
        integer output_ordinal FK
        integer attempt_no UK "task+ordinal+no唯一"
        string provider_request_id
        enum status "prepared/dispatching/running/succeeded/failed/unknown/cancelled"
        string lease_owner
        timestamptz lease_until
        uuid fencing_token
        string error_code
        timestamptz started_at
        timestamptz finished_at
        timestamptz created_at
    }
    
    generation_batches {
        uuid id PK
        uuid task_id FK UK "一对一"
        uuid brief_revision_id FK
        uuid direction_id FK
        uuid parent_version_id FK
        integer count
        uuid model_config_id FK
        timestamptz created_at
    }
    
    %% ===== 版本域 =====
    image_versions {
        uuid id PK
        uuid project_id FK
        uuid asset_id FK UK "主资产唯一"
        uuid parent_version_id FK "自引用树"
        uuid task_id FK
        integer output_ordinal UK "task+ordinal唯一"
        integer sequence UK "project+sequence唯一,显示用V1/V2"
        uuid brief_revision_id FK
        uuid created_by FK
        timestamptz created_at
    }
    
    %% ===== 对话与 Agent 域 =====
    conversations {
        uuid id PK
        uuid project_id FK UK "MVP每项目一个"
        string title
        uuid active_run_id FK
        timestamptz created_at
        timestamptz updated_at
    }
    
    messages {
        uuid id PK
        uuid conversation_id FK
        enum role "user/assistant/system"
        jsonb parts "text/execution_summary/tool/asset/task/confirmation/error"
        enum status "pending/streaming/completed/interrupted/failed"
        string client_message_id UK "会话内幂等"
        uuid created_by FK
        timestamptz created_at
    }
    
    agent_runs {
        uuid id PK
        uuid conversation_id FK
        uuid task_id FK UK "一对一"
        uuid confirmation_id FK
        uuid input_message_id FK
        text summary
        integer tool_call_count
        integer active_elapsed_ms
        timestamptz created_at
        timestamptz updated_at
    }
    
    confirmations {
        uuid id PK
        uuid run_id FK
        uuid project_id FK
        uuid requested_by FK
        enum action "apply_brief_patch/create_generation"
        jsonb payload
        string payload_hash
        timestamptz expires_at
        enum status "pending/approved/rejected/expired"
        uuid result_task_id FK "批准后任务"
        uuid result_brief_revision_id FK "批准后Brief"
        timestamptz created_at
        timestamptz updated_at
    }
    
    tool_executions {
        uuid id PK
        uuid run_id FK
        string call_id UK "run+call_id唯一"
        string tool_name
        enum status "running/succeeded/failed"
        text input_summary
        text output_summary
        uuid task_id FK
        timestamptz created_at
        timestamptz updated_at
    }
    
    %% ===== 配置与审计域 =====
    model_configs {
        uuid id PK
        string provider_key
        string model_id
        string display_name
        jsonb capabilities
        jsonb pricing_snapshot
        boolean enabled
        integer revision
        timestamptz created_at
        timestamptz updated_at
    }
    
    prompt_versions {
        uuid id PK
        string name
        string version UK "name+version唯一"
        string content_hash
        text content
        uuid created_by FK
        timestamptz created_at
    }
    
    usage_ledger {
        uuid id PK
        uuid task_id FK
        uuid attempt_id FK
        uuid user_id FK
        string provider
        string model
        bigint amount_minor "最小货币单位"
        string currency
        date period_date
        enum status "estimated/actual/unknown"
        uuid reservation_id "预留/结算关联"
        enum record_kind "reservation/settlement/release"
        timestamptz created_at
    }
    
    quota_limits {
        uuid id PK
        enum scope_type "system/user/project"
        uuid scope_id UK "scope_type+scope_id+period+currency唯一"
        enum period "daily/monthly"
        bigint limit_minor
        string currency
        integer revision
        timestamptz created_at
        timestamptz updated_at
    }
    
    audit_logs {
        uuid id PK
        uuid actor_id FK
        uuid project_id FK
        string action
        string resource_type
        uuid resource_id
        string request_id
        jsonb change_summary "脱敏"
        timestamptz created_at
    }
    
    %% ===== 导出域 =====
    export_items {
        uuid id PK
        uuid task_id FK UK "task+version唯一"
        uuid version_id FK
        integer ordinal
        timestamptz created_at
    }
    
    %% ===== 基础设施域 =====
    idempotency_keys {
        uuid id PK
        uuid actor_id FK
        string operation UK "actor+operation+key唯一"
        string key
        string request_hash
        uuid resource_id
        integer response_status
        timestamptz expires_at
        timestamptz created_at
    }
    
    outbox_events {
        uuid id PK
        string event_type
        uuid aggregate_id
        jsonb payload
        timestamptz available_at
        integer attempts
        timestamptz published_at
        timestamptz created_at
    }
    
    %% ===== 核心关系 =====
    
    %% 用户相关
    users ||--o{ sessions : "has"
    users ||--o{ customers : "creates"
    users ||--o{ projects : "owns"
    users ||--o{ project_members : "is_member"
    users ||--o{ project_members : "adds"
    users ||--o{ tasks : "requests"
    users ||--o{ messages : "sends"
    users ||--o{ audit_logs : "performs"
    
    %% 项目核心关系
    customers ||--o{ projects : "has"
    projects ||--o{ project_members : "has"
    projects ||--o{ project_reviews : "has"
    projects ||--o{ project_events : "emits"
    projects ||--o{ brief_revisions : "has"
    projects ||--o{ design_directions : "has"
    projects ||--o{ assets : "owns"
    projects ||--o{ tasks : "contains"
    projects ||--o{ image_versions : "has"
    projects ||--o{ conversations : "has"
    projects ||--|| brief_revisions : "current_brief"
    projects ||--o| image_versions : "selected_version"
    
    %% Brief 与设计方向
    brief_revisions ||--o{ design_directions : "generates"
    brief_revisions ||--o{ generation_batches : "used_in"
    brief_revisions ||--o{ image_versions : "source"
    brief_revisions ||--o{ project_reviews : "reviewed"
    
    %% 任务关系
    tasks ||--o{ task_inputs : "has"
    tasks ||--o{ task_outputs : "produces"
    tasks ||--o{ task_attempts : "has"
    tasks ||--o| generation_batches : "details"
    tasks ||--o{ export_items : "includes"
    tasks ||--o| agent_runs : "executes"
    tasks ||--o{ tool_executions : "creates"
    tasks ||--o{ usage_ledger : "incurs"
    tasks ||--o{ outbox_events : "triggers"
    tasks ||--o{ tasks : "retry_chain"
    
    %% 任务输出关系
    task_outputs ||--o{ task_attempts : "has"
    task_outputs ||--o| assets : "produces"
    task_outputs ||--o| image_versions : "creates"
    
    %% 资产关系
    assets ||--o{ task_inputs : "used_in"
    assets ||--o{ image_versions : "is_main"
    assets ||--o{ assets : "derives"
    upload_sessions ||--o| assets : "creates"
    
    %% 版本关系
    image_versions ||--o{ image_versions : "parent_child"
    image_versions ||--o{ generation_batches : "parent"
    image_versions ||--o{ export_items : "exported"
    image_versions ||--o{ project_reviews : "reviewed"
    
    %% 对话与 Agent
    conversations ||--o{ messages : "contains"
    conversations ||--o{ agent_runs : "has"
    agent_runs ||--o{ confirmations : "requests"
    agent_runs ||--o{ tool_executions : "performs"
    confirmations ||--o| tasks : "creates"
    confirmations ||--o| brief_revisions : "creates"
    
    %% 配置关系
    model_configs ||--o{ generation_batches : "used_by"
    
    %% 设计方向关系
    design_directions ||--o{ generation_batches : "generates_from"
    tasks ||--o{ design_directions : "produces"
```

## 关键约束说明

### 唯一性约束
- `users.email`: 规范化后全局唯一
- `sessions.token_hash`: 散列值唯一
- `project_members.(project_id, user_id)`: 项目成员唯一
- `brief_revisions.(project_id, number)`: 项目内版本号唯一
- `assets.(bucket, object_key)`: 对象存储键唯一
- `task_outputs.(task_id, ordinal)`: 任务内输出序号唯一
- `task_attempts.(task_id, output_ordinal, attempt_no)`: 尝试编号唯一
- `image_versions.asset_id`: 主资产一对一
- `image_versions.(project_id, sequence)`: 项目内显示序号唯一
- `image_versions.(task_id, output_ordinal)`: 任务输出一对一
- `project_events.(project_id, sequence)`: 项目事件序列唯一
- `messages.client_message_id`: 会话内幂等键唯一
- `prompt_versions.(name, version)`: Prompt 版本唯一
- `quota_limits.(scope_type, scope_id, period, currency)`: 额度配置唯一
- `idempotency_keys.(actor_id, operation, key)`: 操作幂等键唯一

### 外键约束
- 所有业务表必须通过 `project_id` 验证同项目
- `projects.current_brief_revision_id` 必须是该项目的 Brief
- `projects.selected_version_id` 必须是该项目的版本
- `image_versions.parent_version_id` 必须是同项目的版本
- `generation_batches.parent_version_id` 必须是同项目的版本
- `task_inputs.asset_id` 必须是同项目且 ready 的资产
- 输入资产的 `kind` 必须符合任务类型要求

### 状态约束
- 项目状态转换受 FR-02 约束
- 任务状态转换受第 8.1 节约束
- 资产/上传会话/确认等各有固定终态
- `revision` 字段用于乐观锁，冲突返回 409

### 数据完整性
- Brief 内容不可变，修改产生新 revision
- 版本通过 `parent_version_id` 形成树，禁止循环
- 任务快照保存创建时的完整上下文
- 费用预留、结算、释放通过 `reservation_id` 关联
- Outbox 事件与业务状态在同一事务提交

## 索引建议

基于文档第 7.3 节，至少需要以下索引：

```sql
-- 成员查询
CREATE INDEX idx_project_members_user ON project_members(user_id);
CREATE INDEX idx_project_members_project ON project_members(project_id);

-- 项目列表
CREATE INDEX idx_projects_status_updated ON projects(status, updated_at DESC, id DESC);

-- 资产查询
CREATE INDEX idx_assets_project_kind_created ON assets(project_id, kind, created_at DESC);

-- 版本查询
CREATE INDEX idx_versions_project_sequence ON image_versions(project_id, sequence DESC);
CREATE INDEX idx_versions_parent ON image_versions(parent_version_id);

-- 任务查询
CREATE INDEX idx_tasks_project_status_created ON tasks(project_id, status, created_at DESC);
CREATE INDEX idx_tasks_status_lease ON tasks(status, lease_until) WHERE status IN ('queued', 'running');

-- 消息查询
CREATE INDEX idx_messages_conversation_created ON messages(conversation_id, created_at DESC, id DESC);

-- Outbox 投递
CREATE INDEX idx_outbox_unpublished ON outbox_events(available_at) WHERE published_at IS NULL;

-- 项目事件
CREATE INDEX idx_project_events_sequence ON project_events(project_id, sequence DESC);

-- 审计查询
CREATE INDEX idx_audit_project_created ON audit_logs(project_id, created_at DESC);
CREATE INDEX idx_audit_actor_created ON audit_logs(actor_id, created_at DESC);
