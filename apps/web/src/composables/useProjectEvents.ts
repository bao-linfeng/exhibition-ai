import { ref, onMounted, onUnmounted, computed, readonly, type Ref } from 'vue';
import type { ProjectEvent } from '@exhibition/contracts';

export interface UseProjectEventsOptions {
  /**
   * 项目 ID
   */
  projectId: string;

  /**
   * 是否自动连接（默认 true）
   */
  autoConnect?: boolean;

  /**
   * 从指定 sequence 开始（用于断点续传）
   */
  afterSequence?: number;

  /**
   * 事件回调
   */
  onEvent?: (event: ProjectEvent) => void;

  /**
   * 连接打开回调
   */
  onOpen?: () => void;

  /**
   * 连接关闭回调
   */
  onClose?: (reason?: string) => void;

  /**
   * 错误回调
   */
  onError?: (error: Event) => void;
}

export interface UseProjectEventsReturn {
  /**
   * 连接状态
   */
  status: Readonly<Ref<'connecting' | 'connected' | 'disconnected' | 'error'>>;

  /**
   * 最近收到的事件列表（最多保留 100 条）
   */
  events: Readonly<Ref<ProjectEvent[]>>;

  /**
   * 最新的事件 sequence
   */
  latestSequence: Readonly<Ref<number | null>>;

  /**
   * 手动连接
   */
  connect: () => void;

  /**
   * 手动断开
   */
  disconnect: () => void;

  /**
   * 重新连接（从最新 sequence 继续）
   */
  reconnect: () => void;

  /**
   * 是否已连接
   */
  isConnected: Readonly<Ref<boolean>>;
}

const MAX_EVENTS_IN_MEMORY = 100;

/**
 * Vue 组合式函数：订阅项目实时事件
 *
 * @example
 * ```vue
 * <script setup lang="ts">
 * const { status, events, latestSequence, isConnected } = useProjectEvents({
 *   projectId: route.params.id,
 *   onEvent: (event) => {
 *     console.log('收到事件:', event.type, event.data);
 *   }
 * });
 * </script>
 *
 * <template>
 *   <div>
 *     <p>状态: {{ status }}</p>
 *     <p>最新序号: {{ latestSequence }}</p>
 *     <ul>
 *       <li v-for="event in events" :key="event.id">
 *         {{ event.type }} - {{ event.createdAt }}
 *       </li>
 *     </ul>
 *   </div>
 * </template>
 * ```
 */
export function useProjectEvents(
  options: UseProjectEventsOptions,
): UseProjectEventsReturn {
  const {
    projectId,
    autoConnect = true,
    afterSequence,
    onEvent,
    onOpen,
    onClose,
    onError,
  } = options;

  const status = ref<'connecting' | 'connected' | 'disconnected' | 'error'>(
    'disconnected',
  );
  const events = ref<ProjectEvent[]>([]);
  const latestSequence = ref<number | null>(afterSequence ?? null);
  let eventSource: EventSource | null = null;
  let reconnectTimer: number | null = null;

  const isConnected = computed(() => status.value === 'connected');

  const connect = () => {
    if (eventSource) {
      disconnect();
    }

    status.value = 'connecting';

    // 构建 URL
    const url = new URL(`/api/v1/projects/${projectId}/events`, window.location.origin);
    if (latestSequence.value !== null) {
      url.searchParams.set('after', String(latestSequence.value));
    }

    // 创建 EventSource（自动带 Cookie）
    eventSource = new EventSource(url.toString(), {
      withCredentials: true,
    });

    // 连接打开
    eventSource.addEventListener('open', () => {
      status.value = 'connected';
      onOpen?.();
    });

    // 通用事件监听器（捕获所有事件类型）
    eventSource.addEventListener('message', (e: MessageEvent) => {
      try {
        const event = JSON.parse(e.data) as ProjectEvent;

        // 更新最新 sequence
        if (event.sequence > (latestSequence.value ?? -1)) {
          latestSequence.value = event.sequence;
        }

        // 添加到事件列表（保留最近 100 条）
        events.value.push(event);
        if (events.value.length > MAX_EVENTS_IN_MEMORY) {
          events.value.shift();
        }

        // 触发回调
        onEvent?.(event);
      } catch (err) {
        console.error('[useProjectEvents] 解析事件失败:', err, e.data);
      }
    });

    // 监听特定事件类型（可选，用于类型化处理）
    const eventTypes = [
      'project.created',
      'project.updated',
      'project.archived',
      'project.restored',
      'brief.confirmed',
      'task.updated',
      'version.created',
      'asset.ready',
    ];

    eventTypes.forEach((type) => {
      eventSource!.addEventListener(type, (e: MessageEvent) => {
        // 已在 message 处理器中统一处理，这里可以添加特定逻辑
      });
    });

    // 连接关闭
    eventSource.addEventListener('connection.closed', (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        disconnect();
        onClose?.(data.reason);
      } catch {
        disconnect();
        onClose?.();
      }
    });

    // 流重置（cursor 过期）
    eventSource.addEventListener('stream.reset', () => {
      console.warn('[useProjectEvents] 流重置，需要重新获取快照');
      latestSequence.value = null;
      events.value = [];
      reconnect();
    });

    // 错误处理
    eventSource.addEventListener('error', (e: Event) => {
      console.error('[useProjectEvents] SSE 连接错误:', e);
      status.value = 'error';
      onError?.(e);

      // 自动重连（指数退避）
      if (eventSource?.readyState === EventSource.CLOSED) {
        scheduleReconnect();
      }
    });
  };

  const disconnect = () => {
    if (eventSource) {
      eventSource.close();
      eventSource = null;
    }
    if (reconnectTimer !== null) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    status.value = 'disconnected';
  };

  const reconnect = () => {
    disconnect();
    connect();
  };

  let reconnectAttempt = 0;
  const scheduleReconnect = () => {
    if (reconnectTimer !== null) return;

    // 指数退避：1s, 2s, 4s, 8s, 最大 30s
    const delay = Math.min(1000 * Math.pow(2, reconnectAttempt), 30000);
    reconnectAttempt++;

    console.log(`[useProjectEvents] ${delay}ms 后重连...`);
    reconnectTimer = window.setTimeout(() => {
      reconnectTimer = null;
      connect();
    }, delay);
  };

  // 生命周期
  onMounted(() => {
    if (autoConnect) {
      connect();
    }
  });

  onUnmounted(() => {
    disconnect();
  });

  return {
    status: readonly(status) as Readonly<Ref<'connecting' | 'connected' | 'disconnected' | 'error'>>,
    events: readonly(events) as Readonly<Ref<ProjectEvent[]>>,
    latestSequence: readonly(latestSequence) as Readonly<Ref<number | null>>,
    isConnected: readonly(isConnected) as Readonly<Ref<boolean>>,
    connect,
    disconnect,
    reconnect,
  };
}

/**
 * 简化版：仅获取最新事件
 */
export function useLatestProjectEvent(projectId: string) {
  const latestEvent = ref<ProjectEvent | null>(null);

  const { status, isConnected } = useProjectEvents({
    projectId,
    onEvent: (event) => {
      latestEvent.value = event;
    },
  });

  return {
    status,
    isConnected,
    latestEvent: readonly(latestEvent),
  };
}
