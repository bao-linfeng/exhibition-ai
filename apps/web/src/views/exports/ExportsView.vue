<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  useInfiniteExportsQuery,
  useGetExportDownloadUrl,
} from '@/api/queries/exports.js';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table/index.js';
import { Badge } from '@/components/ui/badge/index.js';
import { Button } from '@/components/ui/button/index.js';
import { Loader2, Download, AlertCircle } from '@lucide/vue';
import { useToast } from '@/components/ui/toast/index.js';

const route = useRoute();
const router = useRouter();
const { toast } = useToast();

const projectId = computed(() => route.params.id as string);

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

const queryParams = computed(() => ({
  limit: 20,
}));

const {
  data: exportsData,
  isLoading,
  isError,
  error,
  fetchNextPage,
  hasNextPage,
  isFetchingNextPage,
} = useInfiniteExportsQuery(
  projectId.value,
  queryParams.value,
  refetchInterval.value,
);

const exportsList = computed(() => {
  return exportsData.value?.pages.flatMap((page) => page.data) ?? [];
});

const getDownloadUrl = useGetExportDownloadUrl();
const downloadingIds = ref<Set<string>>(new Set());

async function handleDownload(exportId: string) {
  downloadingIds.value.add(exportId);
  try {
    const url = await getDownloadUrl.mutateAsync({
      projectId: projectId.value,
      exportId,
    });
    window.open(url, '_blank');
  } catch (err) {
    toast({
      title: '获取下载链接失败',
      variant: 'destructive',
      description: err instanceof Error ? err.message : '未知错误',
    });
  } finally {
    downloadingIds.value.delete(exportId);
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

function getStatusLabel(status: string) {
  const map: Record<string, string> = {
    pending: '等待中',
    running: '导出中',
    succeeded: '已完成',
    failed: '失败',
  };
  return map[status] || status;
}

function getStatusCustomClass(status: string) {
  const map: Record<string, string> = {
    pending:
      'bg-slate-500/15 text-slate-700 hover:bg-slate-500/25 border-slate-500/20',
    running:
      'bg-blue-500/15 text-blue-700 hover:bg-blue-500/25 border-blue-500/20',
    succeeded:
      'bg-green-500/15 text-green-700 hover:bg-green-500/25 border-green-500/20',
    failed: 'bg-red-500/15 text-red-700 hover:bg-red-500/25 border-red-500/20',
  };
  return map[status] || '';
}

function goBack() {
  router.push(`/projects/${projectId.value}/versions`);
}
</script>

<template>
  <div class="h-full flex flex-col space-y-6">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-3xl font-bold tracking-tight text-foreground">
          导出历史
        </h1>
        <p class="text-muted-foreground mt-2">
          查看和下载项目资源的导出记录。如需创建新导出，请前往版本页面选择要导出的版本。
        </p>
      </div>
      <div class="flex items-center gap-3">
        <Button variant="outline" @click="goBack">返回版本页</Button>
      </div>
    </div>

    <div
      class="rounded-md border bg-card shadow-sm flex-1 flex flex-col min-h-0 overflow-hidden"
    >
      <div class="overflow-auto flex-1 relative">
        <Table>
          <TableHeader class="sticky top-0 bg-card z-10 shadow-sm">
            <TableRow>
              <TableHead>格式</TableHead>
              <TableHead>包含版本</TableHead>
              <TableHead>状态</TableHead>
              <TableHead>创建时间</TableHead>
              <TableHead>信息</TableHead>
              <TableHead class="text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow v-if="isLoading">
              <TableCell colspan="6" class="h-32 text-center">
                <div
                  class="flex items-center justify-center text-muted-foreground"
                >
                  <Loader2 class="h-5 w-5 animate-spin mr-2" />
                  加载中...
                </div>
              </TableCell>
            </TableRow>
            <TableRow v-else-if="isError">
              <TableCell colspan="6" class="h-32 text-center text-destructive">
                加载失败: {{ error?.message }}
              </TableCell>
            </TableRow>
            <TableRow v-else-if="exportsList.length === 0">
              <TableCell
                colspan="6"
                class="h-32 text-center text-muted-foreground"
              >
                暂无导出记录
              </TableCell>
            </TableRow>
            <TableRow
              v-for="record in exportsList"
              :key="record.id"
              class="hover:bg-muted/30"
            >
              <TableCell class="font-medium uppercase">
                {{ record.format }}
              </TableCell>
              <TableCell>
                {{ record.versionIds?.length || 0 }} 个版本
              </TableCell>
              <TableCell>
                <Badge
                  variant="outline"
                  :class="[
                    'border font-medium',
                    getStatusCustomClass(record.status),
                  ]"
                >
                  {{ getStatusLabel(record.status) }}
                  <Loader2
                    v-if="record.status === 'running'"
                    class="ml-1.5 h-3 w-3 animate-spin inline-block"
                  />
                </Badge>
              </TableCell>
              <TableCell class="text-sm text-muted-foreground">
                {{ formatTime(record.createdAt) }}
              </TableCell>
              <TableCell class="text-sm max-w-[200px] truncate">
                <div
                  v-if="record.errorMessage"
                  class="flex items-center text-destructive"
                  :title="record.errorMessage"
                >
                  <AlertCircle class="h-3.5 w-3.5 mr-1 flex-shrink-0" />
                  <span class="truncate">{{ record.errorMessage }}</span>
                </div>
                <span v-else class="text-muted-foreground">-</span>
              </TableCell>
              <TableCell class="text-right">
                <Button
                  v-if="record.status === 'succeeded'"
                  variant="default"
                  size="sm"
                  @click="handleDownload(record.id)"
                  :disabled="downloadingIds.has(record.id)"
                >
                  <Loader2
                    v-if="downloadingIds.has(record.id)"
                    class="mr-2 h-3.5 w-3.5 animate-spin"
                  />
                  <Download v-else class="mr-2 h-3.5 w-3.5" />
                  下载 ZIP
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
