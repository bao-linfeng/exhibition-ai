<script setup lang="ts">
import { ref, computed } from 'vue';
import { useInfiniteAuditLogsQuery } from '@/api/queries/settings.js';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table/index.js';
import { Input } from '@/components/ui/input/index.js';
import { Button } from '@/components/ui/button/index.js';
import { Loader2, Search } from '@lucide/vue';
import { Badge } from '@/components/ui/badge/index.js';
import type { AuditEventType } from '@exhibition/contracts';

const eventTypeFilter = ref('');
const appliedEventType = ref<AuditEventType | ''>('');

const queryParams = computed(() => ({
  eventType: appliedEventType.value ? appliedEventType.value : undefined,
  limit: 20,
}));

const {
  data: auditData,
  isLoading,
  isError,
  error,
  fetchNextPage,
  hasNextPage,
  isFetchingNextPage,
} = useInfiniteAuditLogsQuery(queryParams.value);

const auditLogs = computed(() => {
  return auditData.value?.pages.flatMap((page) => page.data) ?? [];
});

function applyFilter() {
  appliedEventType.value = eventTypeFilter.value as AuditEventType;
}

function formatTime(dateStr: string | null) {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
  }).format(date);
}
</script>

<template>
  <div class="h-full flex flex-col space-y-4">
    <div class="flex items-center gap-3 justify-end">
      <div class="relative w-[240px]">
        <Input
          v-model="eventTypeFilter"
          placeholder="过滤事件类型 (如 user.login)"
          @keyup.enter="applyFilter"
        />
      </div>
      <Button variant="secondary" @click="applyFilter">
        <Search class="w-4 h-4 mr-2" />
        搜索
      </Button>
    </div>

    <div
      class="rounded-md border bg-card shadow-sm flex-1 flex flex-col min-h-0 overflow-hidden"
    >
      <div class="overflow-auto flex-1 relative">
        <Table>
          <TableHeader class="sticky top-0 bg-card z-10 shadow-sm">
            <TableRow>
              <TableHead>时间</TableHead>
              <TableHead>操作人</TableHead>
              <TableHead>事件</TableHead>
              <TableHead>资源</TableHead>
              <TableHead>IP</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow v-if="isLoading">
              <TableCell colspan="5" class="h-32 text-center">
                <div
                  class="flex items-center justify-center text-muted-foreground"
                >
                  <Loader2 class="h-5 w-5 animate-spin mr-2" />
                  加载中...
                </div>
              </TableCell>
            </TableRow>
            <TableRow v-else-if="isError">
              <TableCell colspan="5" class="h-32 text-center text-destructive">
                加载失败: {{ error?.message }}
              </TableCell>
            </TableRow>
            <TableRow v-else-if="auditLogs.length === 0">
              <TableCell
                colspan="5"
                class="h-32 text-center text-muted-foreground"
              >
                没有找到审计日志
              </TableCell>
            </TableRow>
            <TableRow
              v-for="log in auditLogs"
              :key="log.id"
              class="hover:bg-muted/30"
            >
              <TableCell
                class="text-sm text-muted-foreground whitespace-nowrap"
              >
                {{ formatTime(log.createdAt) }}
              </TableCell>
              <TableCell>
                <div class="font-medium">
                  {{ log.actorEmail || log.actorId }}
                </div>
              </TableCell>
              <TableCell>
                <Badge
                  variant="outline"
                  class="font-mono text-xs border-slate-500/20 bg-slate-500/10 text-slate-700"
                >
                  {{ log.eventType }}
                </Badge>
              </TableCell>
              <TableCell class="text-sm">
                <span v-if="log.resourceType" class="text-muted-foreground mr-1"
                  >{{ log.resourceType }}:</span
                >
                <span
                  class="font-mono text-xs"
                  :title="log.resourceId ?? undefined"
                  >{{
                    log.resourceId
                      ? log.resourceId.length > 8
                        ? log.resourceId.slice(0, 8) + '...'
                        : log.resourceId
                      : '-'
                  }}</span
                >
              </TableCell>
              <TableCell
                class="text-sm text-muted-foreground font-mono text-xs"
              >
                {{ log.ipAddress || '-' }}
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
