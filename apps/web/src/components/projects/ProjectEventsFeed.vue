<template>
  <div class="project-events-feed">
    <div class="flex items-center justify-between mb-4">
      <h3 class="text-lg font-semibold">项目动态</h3>
      <div class="flex items-center gap-2">
        <span
          class="inline-flex items-center gap-1.5 text-sm"
          :class="{
            'text-green-600': isConnected,
            'text-gray-400': status === 'disconnected',
            'text-yellow-600': status === 'connecting',
            'text-red-600': status === 'error',
          }"
        >
          <span
            class="w-2 h-2 rounded-full"
            :class="{
              'bg-green-600 animate-pulse': isConnected,
              'bg-gray-400': status === 'disconnected',
              'bg-yellow-600 animate-pulse': status === 'connecting',
              'bg-red-600': status === 'error',
            }"
          />
          {{ statusText }}
        </span>
        <button
          v-if="!isConnected"
          class="text-sm text-blue-600 hover:text-blue-700"
          @click="reconnect"
        >
          重新连接
        </button>
      </div>
    </div>

    <div class="space-y-2 max-h-96 overflow-y-auto">
      <div
        v-if="events.length === 0"
        class="text-center py-8 text-gray-500"
      >
        暂无动态
      </div>

      <div
        v-for="event in sortedEvents"
        :key="event.id"
        class="p-3 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors"
      >
        <div class="flex items-start justify-between">
          <div class="flex-1">
            <div class="flex items-center gap-2">
              <span
                class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
                :class="getEventTypeClass(event.type)"
              >
                {{ getEventTypeLabel(event.type) }}
              </span>
              <span class="text-xs text-gray-500">
                #{{ event.sequence }}
              </span>
            </div>
            <p class="mt-1 text-sm text-gray-700">
              {{ getEventDescription(event) }}
            </p>
            <p class="mt-1 text-xs text-gray-500">
              {{ formatTimestamp(event.timestamp) }}
            </p>
          </div>
        </div>
      </div>
    </div>

    <div
      v-if="latestSequence !== null"
      class="mt-2 text-xs text-gray-500 text-center"
    >
      最新序号: {{ latestSequence }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useProjectEvents } from '@/composables/useProjectEvents';
import type { ProjectEvent } from '@exhibition/contracts';

const props = defineProps<{
  projectId: string;
}>();

const { status, events, latestSequence, isConnected, reconnect } =
  useProjectEvents({
    projectId: props.projectId,
    onEvent: (event) => {
      console.log('[ProjectEventsFeed] 收到事件:', event.type);
    },
    onOpen: () => {
      console.log('[ProjectEventsFeed] SSE 连接已建立');
    },
    onClose: (reason) => {
      console.log('[ProjectEventsFeed] SSE 连接已关闭:', reason);
    },
    onError: (error) => {
      console.error('[ProjectEventsFeed] SSE 错误:', error);
    },
  });

const statusText = computed(() => {
  switch (status.value) {
    case 'connecting':
      return '连接中...';
    case 'connected':
      return '实时同步';
    case 'disconnected':
      return '已断开';
    case 'error':
      return '连接失败';
    default:
      return '未知';
  }
});

const sortedEvents = computed(() => {
  return [...events.value].reverse(); // 最新的在前
});

function getEventTypeClass(type: string): string {
  const classMap: Record<string, string> = {
    'project.created': 'bg-blue-100 text-blue-700',
    'project.updated': 'bg-green-100 text-green-700',
    'project.archived': 'bg-gray-100 text-gray-700',
    'project.restored': 'bg-blue-100 text-blue-700',
    'brief.confirmed': 'bg-purple-100 text-purple-700',
    'task.updated': 'bg-yellow-100 text-yellow-700',
    'version.created': 'bg-green-100 text-green-700',
    'asset.ready': 'bg-indigo-100 text-indigo-700',
  };
  return classMap[type] || 'bg-gray-100 text-gray-700';
}

function getEventTypeLabel(type: string): string {
  const labelMap: Record<string, string> = {
    'project.created': '项目创建',
    'project.updated': '项目更新',
    'project.archived': '项目归档',
    'project.restored': '项目恢复',
    'brief.confirmed': 'Brief 确认',
    'task.updated': '任务更新',
    'version.created': '版本创建',
    'asset.ready': '资产就绪',
  };
  return labelMap[type] || type;
}

function getEventDescription(event: ProjectEvent): string {
  switch (event.type) {
    case 'project.created':
      return '项目已创建';
    case 'project.updated':
      return '项目信息已更新';
    case 'project.archived':
      return '项目已归档';
    case 'project.restored':
      return '项目已恢复';
    case 'brief.confirmed':
      return `Brief 修订版 ${event.data.revisionNumber} 已确认`;
    case 'task.updated':
      return `任务 ${event.data.status}`;
    case 'version.created':
      return `版本 V${event.data.sequence} 已创建`;
    case 'asset.ready':
      return `资产 ${event.data.kind} 已就绪`;
    case 'message.delta':
      return '消息增量更新';
    case 'message.completed':
      return '消息已完成';
    case 'confirmation.created':
      return '确认请求已创建';
    case 'stream.reset':
      return '事件流已重置';
    default:
      return '未知事件';
  }
}

function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);

  if (diffSec < 60) {
    return '刚刚';
  } else if (diffMin < 60) {
    return `${diffMin} 分钟前`;
  } else if (diffHour < 24) {
    return `${diffHour} 小时前`;
  } else {
    return date.toLocaleString('zh-CN');
  }
}
</script>

<style scoped>
.project-events-feed {
  @apply bg-white rounded-lg border border-gray-200 p-4;
}
</style>
