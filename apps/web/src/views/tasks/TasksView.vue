<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import {
  useInfiniteTasksQuery,
  useCancelTask,
  useRetryTask,
} from '@/api/queries/tasks.js';
import type { TaskKind, TaskStatus, Task } from '@exhibition/contracts';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table/index.js';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select/index.js';
import { Badge } from '@/components/ui/badge/index.js';
import { Button } from '@/components/ui/button/index.js';
import { Loader2 } from '@lucide/vue';
import { useToast } from '@/components/ui/toast/index.js';

const { toast } = useToast();

const isVisible = ref(!document.hidden);
const handleVisibilityChange = () => {
  isVisible.value = !document.hidden;
};

onMounted(() => {
  document.addEventListener('visibilitychange', handleVisibilityChange);
});
onUnmounted(() => {
  document.removeEventListener('visibilitychange', handleVisibilityChange);
});

const refetchInterval = computed(() => (isVisible.value ? 5000 : 30000));

const statusFilter = ref<TaskStatus | 'all'>('all');
const kindFilter = ref<TaskKind | 'all'>('all');

const queryParams = computed(() => ({
  status:
    statusFilter.value === 'all'
      ? undefined
      : (statusFilter.value as TaskStatus),
  kind: kindFilter.value === 'all' ? undefined : (kindFilter.value as TaskKind),
  limit: 20,
}));

const {
  data: tasksData,
  isLoading,
  isError,
  error,
  fetchNextPage,
  hasNextPage,
  isFetchingNextPage,
} = useInfiniteTasksQuery(queryParams.value, refetchInterval.value);

const tasks = computed(() => {
  return tasksData.value?.pages.flatMap((page) => page.data) ?? [];
});

const cancelTask = useCancelTask();
const retryTask = useRetryTask();
const processingIds = ref<Set<string>>(new Set());

async function handleCancel(taskId: string) {
  processingIds.value.add(taskId);
  try {
    await cancelTask.mutateAsync(taskId);
    toast({ title: '任务已取消' });
  } catch (err) {
    toast({
      title: '取消失败',
      variant: 'destructive',
      description: err instanceof Error ? err.message : '未知错误',
    });
  } finally {
    processingIds.value.delete(taskId);
  }
}

async function handleRetry(taskId: string) {
  processingIds.value.add(taskId);
  try {
    await retryTask.mutateAsync(taskId);
    toast({ title: '任务已重试' });
  } catch (err) {
    toast({
      title: '重试失败',
      variant: 'destructive',
      description: err instanceof Error ? err.message : '未知错误',
    });
  } finally {
    processingIds.value.delete(taskId);
  }
}

function formatTime(dateStr: string | null) {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  return new Intl.DateTimeFormat('zh-CN', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
  }).format(date);
}

function getDuration(task: Task) {
  if (!task.startedAt) return '-';
  const start = new Date(task.startedAt).getTime();
  const end = task.finishedAt
    ? new Date(task.finishedAt).getTime()
    : Date.now();
  const diffMs = Math.max(0, end - start);
  const secs = Math.floor(diffMs / 1000);
  if (secs < 60) return `${secs} 秒`;
  const mins = Math.floor(secs / 60);
  const remainingSecs = secs % 60;
  return `${mins}分 ${remainingSecs}秒`;
}

function getKindLabel(kind: string) {
  const map: Record<string, string> = {
    image_generation: '图片生成',
    asset_validation: '素材校验',
    brief_parse: 'Brief 解析',
    design_direction: '设计方向',
    agent_run: 'Agent 运行',
    export: '导出',
  };
  return map[kind] || kind;
}

function getStatusLabel(status: string) {
  const map: Record<string, string> = {
    pending: '等待中',
    queued: '已排队',
    running: '运行中',
    awaiting_confirmation: '等待确认',
    succeeded: '成功',
    partially_succeeded: '部分成功',
    failed: '失败',
    cancelled: '已取消',
    reconciling: '对账中',
  };
  return map[status] || status;
}

function getStatusVariant(status: string) {
  const map: Record<
    string,
    'default' | 'secondary' | 'destructive' | 'outline'
  > = {
    pending: 'secondary',
    queued: 'secondary',
    running: 'default',
    awaiting_confirmation: 'default',
    succeeded: 'default',
    partially_succeeded: 'destructive', // yellow-ish ideally, we use custom class later
    failed: 'destructive',
    cancelled: 'secondary',
    reconciling: 'secondary',
  };
  return map[status] || 'default';
}

function getStatusCustomClass(status: string) {
  const map: Record<string, string> = {
    pending:
      'bg-slate-500/15 text-slate-700 hover:bg-slate-500/25 border-slate-500/20',
    queued:
      'bg-slate-500/15 text-slate-700 hover:bg-slate-500/25 border-slate-500/20',
    running:
      'bg-blue-500/15 text-blue-700 hover:bg-blue-500/25 border-blue-500/20',
    succeeded:
      'bg-green-500/15 text-green-700 hover:bg-green-500/25 border-green-500/20',
    partially_succeeded:
      'bg-yellow-500/15 text-yellow-700 hover:bg-yellow-500/25 border-yellow-500/20',
    failed: 'bg-red-500/15 text-red-700 hover:bg-red-500/25 border-red-500/20',
    cancelled:
      'bg-slate-500/15 text-slate-700 hover:bg-slate-500/25 border-slate-500/20',
    reconciling:
      'bg-purple-500/15 text-purple-700 hover:bg-purple-500/25 border-purple-500/20',
  };
  return map[status] || '';
}

function getProgressText(task: Task) {
  if (task.kind === 'image_generation' && task.outputs.length > 0) {
    const finishedCount = task.outputs.filter((o) =>
      ['succeeded', 'failed', 'cancelled'].includes(o.state),
    ).length;
    return `${finishedCount} / ${task.outputs.length} 张`;
  }
  if (task.progress !== null) {
    return `${Math.round(task.progress * 100)}%`;
  }
  return '-';
}
</script>

<template>
  <div class="h-full flex flex-col space-y-6">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-3xl font-bold tracking-tight text-foreground">
          任务中心
        </h1>
        <p class="text-muted-foreground mt-2">
          查看和管理您的所有后台任务和运行状态。
        </p>
      </div>
      <div class="flex items-center gap-3">
        <Select v-model="kindFilter">
          <SelectTrigger class="w-[160px]">
            <SelectValue placeholder="任务类型" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部类型</SelectItem>
            <SelectItem value="image_generation">图片生成</SelectItem>
            <SelectItem value="asset_validation">素材校验</SelectItem>
            <SelectItem value="design_direction">设计方向</SelectItem>
            <SelectItem value="brief_parse">Brief 解析</SelectItem>
          </SelectContent>
        </Select>

        <Select v-model="statusFilter">
          <SelectTrigger class="w-[160px]">
            <SelectValue placeholder="任务状态" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部状态</SelectItem>
            <SelectItem value="running">进行中 (running)</SelectItem>
            <SelectItem value="succeeded">已完成</SelectItem>
            <SelectItem value="failed">已失败</SelectItem>
            <SelectItem value="cancelled">已取消</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>

    <div
      class="rounded-md border bg-card shadow-sm flex-1 flex flex-col min-h-0 overflow-hidden"
    >
      <div class="overflow-auto flex-1 relative">
        <Table>
          <TableHeader class="sticky top-0 bg-card z-10 shadow-sm">
            <TableRow>
              <TableHead>任务类型</TableHead>
              <TableHead>状态</TableHead>
              <TableHead>进度</TableHead>
              <TableHead>创建时间</TableHead>
              <TableHead>耗时</TableHead>
              <TableHead>详情/错误</TableHead>
              <TableHead class="text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow v-if="isLoading">
              <TableCell colspan="7" class="h-32 text-center">
                <div
                  class="flex items-center justify-center text-muted-foreground"
                >
                  <Loader2 class="h-5 w-5 animate-spin mr-2" />
                  加载中...
                </div>
              </TableCell>
            </TableRow>
            <TableRow v-else-if="isError">
              <TableCell colspan="7" class="h-32 text-center text-destructive">
                加载失败: {{ error?.message }}
              </TableCell>
            </TableRow>
            <TableRow v-else-if="tasks.length === 0">
              <TableCell
                colspan="7"
                class="h-32 text-center text-muted-foreground"
              >
                暂无任务记录
              </TableCell>
            </TableRow>
            <TableRow
              v-for="task in tasks"
              :key="task.id"
              class="hover:bg-muted/30"
            >
              <TableCell class="font-medium">
                {{ getKindLabel(task.kind) }}
              </TableCell>
              <TableCell>
                <Badge
                  :variant="getStatusVariant(task.status)"
                  :class="[
                    'border font-medium',
                    getStatusCustomClass(task.status),
                  ]"
                >
                  {{ getStatusLabel(task.status) }}
                </Badge>
              </TableCell>
              <TableCell class="text-sm text-muted-foreground">
                {{ getProgressText(task) }}
              </TableCell>
              <TableCell class="text-sm text-muted-foreground">
                {{ formatTime(task.createdAt) }}
              </TableCell>
              <TableCell class="text-sm text-muted-foreground">
                {{ getDuration(task) }}
              </TableCell>
              <TableCell class="text-sm max-w-[200px] truncate">
                <span
                  v-if="task.errorMessage"
                  class="text-destructive font-medium"
                  :title="task.errorMessage"
                >
                  {{ task.errorCode }}: {{ task.errorMessage }}
                </span>
                <span v-else class="text-muted-foreground">-</span>
              </TableCell>
              <TableCell class="text-right space-x-2">
                <Button
                  v-if="task.canCancel"
                  variant="outline"
                  size="sm"
                  @click="handleCancel(task.id)"
                  :disabled="processingIds.has(task.id)"
                >
                  <Loader2
                    v-if="processingIds.has(task.id)"
                    class="mr-2 h-3.5 w-3.5 animate-spin"
                  />
                  取消
                </Button>
                <Button
                  v-if="task.canRetry"
                  variant="outline"
                  size="sm"
                  @click="handleRetry(task.id)"
                  :disabled="processingIds.has(task.id)"
                >
                  <Loader2
                    v-if="processingIds.has(task.id)"
                    class="mr-2 h-3.5 w-3.5 animate-spin"
                  />
                  重试
                </Button>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>

      <div
        v-if="hasNextPage"
        class="p-4 border-t flex justify-center bg-muted/20"
      >
        <Button
          variant="outline"
          @click="() => fetchNextPage()"
          :disabled="isFetchingNextPage"
        >
          <Loader2
            v-if="isFetchingNextPage"
            class="mr-2 h-4 w-4 animate-spin"
          />
          加载更多
        </Button>
      </div>
    </div>
  </div>
</template>
