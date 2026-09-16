# SSE 端到端测试指南

## 测试环境要求

- Docker Compose 环境已启动（所有服务健康）
- 已创建测试用户（admin@example.com）
- Node.js 环境（用于运行测试脚本）

## 1. 前置准备

### 启动所有服务

```bash
docker compose --env-file .env -f infra/compose.dev.yaml up -d postgres redis rustfs
docker compose --env-file .env -f infra/compose.dev.yaml run --rm migrate
docker compose --env-file .env -f infra/compose.dev.yaml run --rm storage-init
docker compose --env-file .env -f infra/compose.dev.yaml up -d api worker web
```

### 检查服务健康

```bash
# API 健康检查
curl http://localhost:3000/api/health

# 预期输出: {"status":"ok"}

# 就绪检查
curl http://localhost:3000/api/ready

# 预期输出: {"status":"ready","dependencies":{"postgres":true,"redis":true,"storage":true}}
```

### 创建测试用户（如果尚未创建）

```bash
docker compose --env-file .env -f infra/compose.dev.yaml run --rm devtools node scripts/create-admin.mjs
```

---

## 2. 自动化测试

### 安装依赖（测试脚本需要）

```bash
npm install -g eventsource node-fetch
```

### 运行端到端测试

```bash
node scripts/test-sse-e2e.mjs
```

**预期输出**：

```
========================================
SSE 端到端测试
========================================

ℹ 登录测试用户...
✓ 登录成功
  Cookie: session=...

ℹ 创建测试项目...
✓ 项目创建成功: <uuid>

--- 测试 1: SSE 连接 ---
ℹ 测试 SSE 连接...
  连接 URL: http://localhost:3000/api/v1/projects/<uuid>/events
✓ SSE 连接已建立
  收到心跳 #1
  收到心跳 #2
✓ SSE 连接测试完成（收到 1 个事件，2 个心跳）

--- 测试 2: 事件推送 ---
ℹ 测试事件推送...
ℹ 触发项目更新事件...
  项目更新请求已发送
✓ 收到推送的项目更新事件
  lastEventId: 2

--- 测试 3: 断线重连 ---
ℹ 测试断线重连...
✓ 首次连接成功
✓ 收到事件 sequence=3，关闭连接...
ℹ 使用 after 参数重连...
✓ 重连成功（断点续传）

--- 测试 4: 未授权访问 ---
ℹ 测试未授权访问...
✓ 未授权访问被正确拒绝

========================================
✓ 所有测试通过 ✓
========================================
```

---

## 3. 手动测试

### 3.1 浏览器控制台测试

1. 打开 http://localhost:5173
2. 登录系统
3. 打开浏览器开发者工具（F12）
4. 在控制台执行以下代码：

```javascript
// 获取当前项目 ID（假设在项目详情页）
const projectId = window.location.pathname.split('/')[2];

// 创建 SSE 连接
const eventSource = new EventSource(
  `/api/v1/projects/${projectId}/events`,
  { withCredentials: true }
);

// 监听连接打开
eventSource.addEventListener('open', () => {
  console.log('✓ SSE 连接已建立');
});

// 监听所有事件
eventSource.addEventListener('message', (e) => {
  console.log('收到消息:', e.data);
});

// 监听项目更新
eventSource.addEventListener('project.updated', (e) => {
  console.log('✓ 项目更新:', JSON.parse(e.data));
  console.log('  lastEventId:', e.lastEventId);
});

// 监听 Brief 确认
eventSource.addEventListener('brief.confirmed', (e) => {
  console.log('✓ Brief 确认:', JSON.parse(e.data));
});

// 监听错误
eventSource.addEventListener('error', (e) => {
  console.error('✗ SSE 错误:', e);
});

// 关闭连接（测试完成后）
// eventSource.close();
```

### 3.2 触发事件并验证

保持 SSE 连接打开，然后：

1. **更新项目**：修改项目名称或备注
   - 预期：控制台收到 `project.updated` 事件

2. **确认 Brief**：在 Brief 编辑页面点击"确认"
   - 预期：控制台收到 `brief.confirmed` 事件

3. **上传资产**：上传一张图片
   - 预期：控制台收到 `asset.ready` 事件（如果已集成）

### 3.3 断点续传测试

```javascript
const projectId = '<your-project-id>';

// 第一次连接
const es1 = new EventSource(`/api/v1/projects/${projectId}/events`);
let lastSequence = null;

es1.addEventListener('project.updated', (e) => {
  lastSequence = e.lastEventId;
  console.log('收到事件，sequence:', lastSequence);
  
  // 关闭连接
  es1.close();
  console.log('连接已关闭');
  
  // 2 秒后使用 after 参数重连
  setTimeout(() => {
    console.log('使用 after=' + lastSequence + ' 重连...');
    const es2 = new EventSource(
      `/api/v1/projects/${projectId}/events?after=${lastSequence}`
    );
    
    es2.addEventListener('open', () => {
      console.log('✓ 重连成功（断点续传）');
    });
    
    es2.addEventListener('project.updated', (e) => {
      console.log('✓ 重连后收到新事件:', e.lastEventId);
    });
  }, 2000);
});

// 触发一个事件以测试
```

---

## 4. 性能测试

### 4.1 并发连接测试

测试多个客户端同时连接：

```bash
# 在不同终端窗口运行
for i in {1..10}; do
  node scripts/test-sse.mjs &
done
```

**验证指标**：
- 所有连接成功建立
- 每个连接独立接收事件
- 服务器内存占用 < 100MB（10 连接）

### 4.2 事件延迟测试

修改 `scripts/test-sse-e2e.mjs`，添加时间戳对比：

```javascript
const beforeUpdate = Date.now();

// 触发更新
await fetch(`${API_URL}/api/v1/projects/${testProjectId}`, {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json', Cookie: authCookie },
  body: JSON.stringify({ notes: 'test', expectedRevision: project.revision })
});

eventSource.addEventListener('project.updated', (event) => {
  const latency = Date.now() - beforeUpdate;
  console.log(`事件延迟: ${latency}ms`);
  // 预期 < 100ms
});
```

**目标指标**：
- P50 延迟 < 50ms
- P95 延迟 < 100ms
- P99 延迟 < 200ms

### 4.3 长连接稳定性测试

```bash
# 保持连接 1 小时
timeout 3600 node scripts/test-sse.mjs
```

**验证**：
- 连接持续稳定
- 心跳正常（每 15 秒）
- 无内存泄漏

---

## 5. Nginx 集成测试

### 5.1 启动带 Nginx 的环境（待实现）

```bash
# 当前开发环境直接暴露端口，生产环境需配置 Nginx
# 参考 infra/nginx/nginx.conf
```

### 5.2 验证 Nginx 配置

通过 Nginx 访问 SSE 端点时，需要验证：

1. **禁用缓冲**：
   ```bash
   curl -i http://localhost/api/v1/projects/<id>/events \
     -H "Cookie: session=..."
   ```
   
   响应头应包含：
   ```
   X-Accel-Buffering: no
   Cache-Control: no-cache
   ```

2. **长连接保持**：
   - 连接应保持打开 > 60 秒
   - 定期收到心跳

3. **CORS 支持**：
   ```bash
   curl -i -X OPTIONS http://localhost/api/v1/projects/<id>/events \
     -H "Origin: http://localhost:5173" \
     -H "Access-Control-Request-Method: GET"
   ```

---

## 6. 故障场景测试

### 6.1 网络中断恢复

1. 建立 SSE 连接
2. 断开网络（或停止 API 服务）
3. 重新连接网络（或启动 API）
4. 验证：客户端自动重连（指数退避）

### 6.2 权限变更

1. 用户 A 连接项目 SSE
2. 管理员移除用户 A 的项目权限
3. 验证：30 秒内连接被服务端关闭

### 6.3 服务重启

1. 建立 SSE 连接
2. 重启 API 服务：
   ```bash
   docker compose restart api
   ```
3. 验证：客户端检测到错误并自动重连

### 6.4 数据库故障

1. 停止 PostgreSQL：
   ```bash
   docker compose stop postgres
   ```
2. 验证：新连接失败（503），已有连接保持
3. 恢复数据库：
   ```bash
   docker compose start postgres
   ```
4. 验证：新连接正常

---

## 7. 前端集成测试

### 7.1 使用 Vue 组件

在任意项目详情页面添加：

```vue
<template>
  <div>
    <h2>项目详情</h2>
    <!-- 其他内容 -->
    
    <!-- SSE 事件动态 -->
    <ProjectEventsFeed :project-id="projectId" />
  </div>
</template>

<script setup lang="ts">
import { useRoute } from 'vue-router';
import ProjectEventsFeed from '@/components/projects/ProjectEventsFeed.vue';

const route = useRoute();
const projectId = route.params.id as string;
</script>
```

### 7.2 验证功能

1. **实时状态显示**：
   - 连接成功：显示"实时同步"（绿色）
   - 连接中：显示"连接中..."（黄色）
   - 断开：显示"已断开"（灰色）

2. **事件列表**：
   - 最新事件在顶部
   - 显示事件类型、描述、时间
   - 最多显示 100 条

3. **手动重连**：
   - 点击"重新连接"按钮
   - 验证：连接重新建立

---

## 8. 监控与日志

### 8.1 查看 API 日志

```bash
docker compose logs -f api | grep -i sse
```

**关键日志**：
```
SSE connection established for project <uuid> by user <uuid>
SSE connection closed for project <uuid>
SSE permission check failed for project <uuid>
```

### 8.2 监控指标（待实现）

理想情况下应监控：
- 活跃 SSE 连接数
- 事件推送速率（events/s）
- 平均事件延迟
- 错误率

---

## 9. 已知限制

1. **单实例部署**：当前使用 EventEmitter，不支持多实例
2. **无事件 TTL**：历史事件无限增长，需要定期清理
3. **无事件过滤**：客户端接收所有类型事件
4. **无连接限流**：单用户可创建无限连接

---

## 10. 验收标准（Issue #21）

根据 tasks.md 的 T021 要求：

- [x] 乱序/重复/断线不倒退状态
- [x] 7天前cursor reset并按latestEventSequence恢复（已实现 `stream.reset`）
- [x] 每15秒心跳
- [x] 30秒复查授权
- [ ] 每用户最多5连接（**待实现限流**）
- [x] 撤权后停止推送
- [ ] 真实反代关闭缓冲与压缩（**需要 Nginx 环境**）
- [ ] 已提交事件更新P95<2秒（**需要性能测试**）
- [ ] 断线5秒内终态恢复可测（**需要验证**）

---

## 11. 下一步

完成 Issue #21 还需要：

1. ✅ **前端集成** - 完成 Vue 组合式函数和示例组件
2. ⏳ **性能测试** - 运行延迟和吞吐量测试
3. ⏳ **连接限流** - 实现每用户最多 5 连接
4. ⏳ **Nginx 部署** - 配置生产环境反向代理
5. ⏳ **文档更新** - 补充 API 文档中的 SSE 端点说明

---

## 附录：故障排查

### 问题：连接立即断开

**可能原因**：
- 未登录或 Session 过期
- 没有项目访问权限
- 防火墙阻止长连接

**解决方法**：
```bash
# 检查 Cookie
curl -i http://localhost:3000/api/v1/auth/me \
  -H "Cookie: session=..."

# 检查项目权限
curl http://localhost:3000/api/v1/projects/<id> \
  -H "Cookie: session=..."
```

### 问题：收不到事件

**可能原因**：
- EventsService 未正确注入
- 事务未提交
- 事件类型拼写错误

**解决方法**：
```bash
# 检查数据库事件表
docker compose exec postgres psql -U exhibition -d exhibition \
  -c "SELECT * FROM project_events ORDER BY sequence DESC LIMIT 10;"

# 检查 API 日志
docker compose logs api --tail 50
```

### 问题：内存泄漏

**可能原因**：
- EventEmitter 监听器未清理
- SSE 连接未正确关闭

**解决方法**：
```bash
# 监控内存使用
docker stats api

# 检查活跃连接数（需要添加监控端点）
curl http://localhost:3000/api/metrics
```
