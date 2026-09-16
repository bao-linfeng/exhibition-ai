# Server-Sent Events (SSE) 实时事件系统

## 概述

本项目实现了基于 SSE 的实时事件推送系统，允许客户端订阅项目相关的实时更新。

## 功能特性

- ✅ **实时推送**: 基于 EventEmitter 的内存订阅，无需轮询
- ✅ **事件持久化**: 所有事件存储在 `project_events` 表中
- ✅ **断点续传**: 支持从指定 sequence 恢复连接
- ✅ **权限控制**: 定期复核用户权限，确保安全
- ✅ **自动清理**: 连接关闭时自动释放资源
- ✅ **心跳保持**: 30 秒心跳防止连接超时

## 架构设计

### 数据库层

- `project_events` 表存储所有事件
- `projects.next_event_sequence` 字段管理序列号
- 复合索引 `(project_id, sequence)` 支持高效查询

### 服务层

- `EventsService`: 事件发布与订阅管理
- `ProjectPolicy`: 权限检查
- EventEmitter: 内存订阅机制

### API 层

- `GET /api/v1/projects/:id/events?after=<sequence>`: SSE 端点

## 支持的事件类型

| 事件类型           | 说明         | 数据字段                                      |
| ------------------ | ------------ | --------------------------------------------- |
| `project.created`  | 项目创建     | `projectId`, `name`, `customerId`, `ownerId`  |
| `project.updated`  | 项目更新     | `projectId`, `changes`                        |
| `project.archived` | 项目归档     | `projectId`, `previousStatus`, `newStatus`    |
| `project.restored` | 项目恢复     | `projectId`, `previousStatus`, `newStatus`    |
| `brief.confirmed`  | Brief 确认   | `revisionId`, `revisionNumber`, `confirmedBy` |
| `task.updated`     | 任务状态更新 | `taskId`, `status`, `progress`                |
| `version.created`  | 版本创建     | `versionId`, `sequence`, `taskId`             |
| `asset.ready`      | 资产就绪     | `assetId`, `url`, `metadata`                  |

## 使用示例

### 1. JavaScript/TypeScript 客户端

```typescript
const eventSource = new EventSource(
  `/api/v1/projects/${projectId}/events?after=${lastSequence}`,
  { withCredentials: true },
);

// 监听特定事件
eventSource.addEventListener('project.updated', (event) => {
  const data = JSON.parse(event.data);
  console.log('项目已更新:', data);
});

// 监听所有消息
eventSource.onmessage = (event) => {
  console.log('收到消息:', event.data);
};

// 错误处理
eventSource.onerror = (error) => {
  console.error('连接错误:', error);
  eventSource.close();
};

// 清理
window.addEventListener('beforeunload', () => {
  eventSource.close();
});
```

### 2. React Hook

```typescript
import { useEffect, useState } from 'react';

interface ProjectEvent {
  id: string;
  type: string;
  projectId: string;
  sequence: number;
  timestamp: string;
  data: Record<string, unknown>;
}

export function useProjectEvents(projectId: string) {
  const [events, setEvents] = useState<ProjectEvent[]>([]);
  const [lastSequence, setLastSequence] = useState(0);

  useEffect(() => {
    const url = `/api/v1/projects/${projectId}/events?after=${lastSequence}`;
    const eventSource = new EventSource(url, { withCredentials: true });

    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data) as ProjectEvent;
      setEvents((prev) => [...prev, data]);
      setLastSequence(data.sequence);
    };

    eventSource.onerror = () => {
      eventSource.close();
    };

    return () => {
      eventSource.close();
    };
  }, [projectId, lastSequence]);

  return events;
}
```

### 3. Vue 3 Composable

```typescript
import { ref, onMounted, onUnmounted } from 'vue';

export function useProjectEvents(projectId: string) {
  const events = ref<ProjectEvent[]>([]);
  const lastSequence = ref(0);
  let eventSource: EventSource | null = null;

  const connect = () => {
    const url = `/api/v1/projects/${projectId}/events?after=${lastSequence.value}`;
    eventSource = new EventSource(url, { withCredentials: true });

    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      events.value.push(data);
      lastSequence.value = data.sequence;
    };

    eventSource.onerror = () => {
      disconnect();
    };
  };

  const disconnect = () => {
    if (eventSource) {
      eventSource.close();
      eventSource = null;
    }
  };

  onMounted(connect);
  onUnmounted(disconnect);

  return { events, reconnect: connect };
}
```

## 测试

### 前置条件

1. 安装依赖:

```bash
pnpm add -D eventsource
```

2. 设置环境变量:

```bash
export PROJECT_ID="<your-project-id>"
export AUTH_TOKEN="<your-session-token>"
```

### 运行测试

1. 启动 SSE 监听器:

```bash
node scripts/test-sse.mjs
```

2. 在另一个终端触发事件:

```bash
node scripts/trigger-test-event.mjs
```

3. 观察第一个终端是否收到 `project.updated` 事件。

## 故障排查

### 连接失败

检查：

- API 服务是否正常运行
- 认证 token 是否有效
- 用户是否有项目访问权限

### 收不到事件

检查：

- EventsService 是否正确传递给业务服务
- 业务逻辑是否调用 `eventsService.appendEvent()`
- 数据库事务是否成功提交

### 性能问题

优化建议：

- 限制单个项目的并发连接数
- 定期清理旧事件（保留最近 N 条）
- 考虑使用 Redis Pub/Sub 支持多实例部署

## 最佳实践

1. **断点续传**: 客户端应保存最后收到的 sequence，重连时传递
2. **错误重试**: 实现指数退避重连策略
3. **心跳检测**: 监听心跳消息，检测连接健康状态
4. **优雅降级**: 连接失败时回退到轮询模式

## 未来改进

- [ ] 支持事件过滤（按类型订阅）
- [ ] 实现事件清理策略（TTL）
- [ ] 添加事件重放功能
- [ ] 支持批量事件推送
- [ ] 集成 Redis Pub/Sub（多实例部署）
- [ ] 添加监控指标（活跃连接数、事件吞吐量）

## 相关文档

- [Server-Sent Events 规范](https://html.spec.whatwg.org/multipage/server-sent-events.html)
- [EventSource API](https://developer.mozilla.org/en-US/docs/Web/API/EventSource)
- [项目事件 Schema](../../packages/contracts/src/events/schemas.ts)
