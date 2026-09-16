<script setup lang="ts">
import { computed } from 'vue';
import { useQuery } from '@tanstack/vue-query';
import { listTasksOptions } from '@/api/queries/tasks.js';
import { Button } from '@/components/ui/button';
import {
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2,
  ListTodo,
} from '@lucide/vue';
import { useRouter } from 'vue-router';
import PageLoading from '@/components/PageLoading.vue';

const props = defineProps<{ projectId: string }>();
const router = useRouter();

const { data: tasksData, isLoading } = useQuery(
  listTasksOptions({ projectId: props.projectId, limit: 20 }, 5000),
);

const activeTasks = computed(() => {
  const activeStatuses = ['pending', 'queued', 'running', 'reconciling'];
  const tasks = tasksData.value?.data ?? [];
  return tasks.filter((t) => activeStatuses.includes(t.status));
});

const recentCompletedTasks = computed(() => {
  const inactiveStatuses = [
    'succeeded',
    'failed',
    'cancelled',
    'partially_succeeded',
  ];
  const tasks = tasksData.value?.data ?? [];
  return tasks.filter((t) => inactiveStatuses.includes(t.status)).slice(0, 5);
});

function getStatusIcon(status: string) {
  switch (status) {
    case 'pending':
    case 'queued':
      return Clock;
    case 'running':
    case 'reconciling':
      return Loader2;
    case 'succeeded':
    case 'partially_succeeded':
      return CheckCircle;
    case 'failed':
      return XCircle;
    default:
      return AlertCircle;
  }
}

function getStatusColor(status: string) {
  switch (status) {
    case 'pending':
    case 'queued':
      return 'text-slate-400';
    case 'running':
    case 'reconciling':
      return 'text-blue-400';
    case 'succeeded':
    case 'partially_succeeded':
      return 'text-green-500';
    case 'failed':
      return 'text-red-500';
    default:
      return 'text-slate-500';
  }
}

function getStatusLabel(status: string) {
  const map: Record<string, string> = {
    pending: '等待中',
    queued: '排队中',
    running: '运行中',
    reconciling: '处理中',
    succeeded: '已完成',
    partially_succeeded: '部分完成',
    failed: '失败',
    cancelled: '已取消',
    awaiting_confirmation: '待确认',
  };
  return map[status] || status;
}

function getTaskKindLabel(kind: string) {
  const map: Record<string, string> = {
    brief_parse: '解析 Brief',
    image_generation: '生成图片',
    asset_validation: '验证素材',
    design_direction: '设计方向',
    agent_run: 'Agent 运行',
    export: '导出',
  };
  return map[kind] || kind;
}

function formatDate(dateStr: string) {
  const date = new Date(dateStr);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
</script>

<template>
  <div class="h-full flex flex-col p-4">
    <div class="flex items-center justify-between mb-4">
      <h3 class="font-semibold text-slate-100">任务队列</h3>
      <Button
        variant="ghost"
        size="sm"
        class="h-8 text-slate-400 hover:text-slate-300"
        @click="router.push(`/tasks?projectId=${projectId}`)"
      >
        <ListTodo class="w-4 h-4 mr-2" />
        全部
      </Button>
    </div>

    <div v-if="isLoading" class="flex-1 flex justify-center items-center">
      <PageLoading />
    </div>

    <div v-else class="flex-1 overflow-y-auto space-y-6 pr-1">
      <!-- Active Tasks -->
      <div>
        <h4
          class="text-xs font-medium text-slate-500 uppercase tracking-wider mb-3"
        >
          活跃任务 ({{ activeTasks.length }})
        </h4>
        <div v-if="activeTasks.length > 0" class="space-y-2">
          <div
            v-for="task in activeTasks"
            :key="task.id"
            class="flex items-start gap-3 p-3 rounded-lg bg-slate-900 border border-slate-800"
          >
            <component
              :is="getStatusIcon(task.status)"
              class="w-4 h-4 mt-0.5 shrink-0"
              :class="[
                getStatusColor(task.status),
                task.status === 'running' || task.status === 'reconciling'
                  ? 'animate-spin'
                  : '',
              ]"
            />
            <div class="flex-1 min-w-0">
              <div class="flex justify-between items-start mb-1">
                <span class="text-sm font-medium text-slate-200 truncate">{{
                  getTaskKindLabel(task.kind)
                }}</span>
                <span class="text-xs text-slate-500 ml-2 whitespace-nowrap">{{
                  formatDate(task.createdAt)
                }}</span>
              </div>
              <div class="text-xs text-slate-400">
                {{ getStatusLabel(task.status) }}
              </div>
            </div>
          </div>
        </div>
        <div
          v-else
          class="text-sm text-slate-500 italic p-3 rounded-lg border border-dashed border-slate-800 flex justify-center items-center"
        >
          暂无活跃任务
        </div>
      </div>

      <!-- Recent Completed -->
      <div v-if="recentCompletedTasks.length > 0">
        <h4
          class="text-xs font-medium text-slate-500 uppercase tracking-wider mb-3"
        >
          最近完成
        </h4>
        <div class="space-y-2">
          <div
            v-for="task in recentCompletedTasks"
            :key="task.id"
            class="flex items-start gap-3 p-2.5 rounded-lg border border-slate-800/50 opacity-70 hover:opacity-100 transition-opacity"
          >
            <component
              :is="getStatusIcon(task.status)"
              class="w-4 h-4 mt-0.5 shrink-0"
              :class="getStatusColor(task.status)"
            />
            <div class="flex-1 min-w-0">
              <div class="flex justify-between items-start">
                <span class="text-sm text-slate-300 truncate">{{
                  getTaskKindLabel(task.kind)
                }}</span>
                <span class="text-xs text-slate-500 ml-2 whitespace-nowrap">{{
                  formatDate(task.finishedAt || task.createdAt)
                }}</span>
              </div>
              <div class="text-xs text-slate-500">
                {{ getStatusLabel(task.status) }}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
