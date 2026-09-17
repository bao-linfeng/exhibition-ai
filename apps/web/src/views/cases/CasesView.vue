<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useRouter } from 'vue-router';
import { watchDebounced } from '@vueuse/core';
import {
  Search,
  Archive,
  Star,
  ChevronLeft,
  ChevronRight,
  Loader2,
} from '@lucide/vue';
import PageHeader from '../../components/PageHeader.vue';
import { Button } from '../../components/ui/button/index.js';
import { Input } from '../../components/ui/input/index.js';
import { Badge } from '../../components/ui/badge/index.js';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../components/ui/table/index.js';
import {
  useCasesQuery,
  type CasesQueryParams,
} from '../../api/queries/cases.js';

const router = useRouter();

const searchInput = ref('');
const search = ref('');
const showFavoritedOnly = ref(false);
const currentCursor = ref<string | undefined>(undefined);
const cursorStack = ref<string[]>([]);

watchDebounced(
  searchInput,
  (val) => {
    search.value = val;
  },
  { debounce: 300 },
);

watch([search, showFavoritedOnly], () => {
  currentCursor.value = undefined;
  cursorStack.value = [];
});

const queryParams = computed<CasesQueryParams>(() => ({
  search: search.value || undefined,
  favorited: showFavoritedOnly.value ? true : undefined,
  cursor: currentCursor.value,
}));

const {
  data: casesData,
  isLoading,
  isError,
  error,
} = useCasesQuery(queryParams);

function viewProject(id: string) {
  router.push(`/projects/${id}`);
}

function nextPage() {
  if (casesData.value?.page?.hasMore && casesData.value?.page?.nextCursor) {
    cursorStack.value.push(currentCursor.value || '');
    currentCursor.value = casesData.value.page.nextCursor;
  }
}

function prevPage() {
  if (cursorStack.value.length > 0) {
    const prevCursor = cursorStack.value.pop();
    currentCursor.value = prevCursor === '' ? undefined : prevCursor;
  }
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('zh-CN');
}
</script>

<template>
  <div>
    <PageHeader title="历史案例库" description="浏览已归档的历史展台设计案例" />

    <div
      class="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"
    >
      <div class="relative w-full max-w-sm">
        <Search
          class="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground"
        />
        <Input
          v-model="searchInput"
          type="text"
          placeholder="搜索案例名称..."
          class="pl-9"
        />
      </div>
      <div class="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          :class="showFavoritedOnly ? 'bg-primary/10 border-primary/30' : ''"
          @click="showFavoritedOnly = !showFavoritedOnly"
        >
          <Star
            class="mr-1 h-4 w-4"
            :class="showFavoritedOnly ? 'fill-primary text-primary' : ''"
          />
          仅收藏
        </Button>
      </div>
    </div>

    <div
      class="rounded-md border bg-card text-card-foreground shadow-sm overflow-hidden"
    >
      <div class="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>案例名称</TableHead>
              <TableHead>客户</TableHead>
              <TableHead>展会</TableHead>
              <TableHead>行业</TableHead>
              <TableHead>标签</TableHead>
              <TableHead>归档时间</TableHead>
              <TableHead class="text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow v-if="isLoading">
              <TableCell colspan="7" class="h-24 text-center">
                <div
                  class="flex items-center justify-center gap-2 text-muted-foreground"
                >
                  <Loader2 class="h-4 w-4 animate-spin" />
                  加载中...
                </div>
              </TableCell>
            </TableRow>

            <TableRow v-else-if="isError">
              <TableCell colspan="7" class="h-24 text-center text-destructive">
                获取案例列表失败: {{ error?.message || '未知错误' }}
              </TableCell>
            </TableRow>

            <TableRow v-else-if="!casesData?.data?.length">
              <TableCell
                colspan="7"
                class="h-32 text-center text-muted-foreground"
              >
                <div class="flex flex-col items-center justify-center">
                  <Archive class="h-8 w-8 mb-2 opacity-50" />
                  <p>暂无历史案例</p>
                  <p class="text-xs mt-1">已归档的项目将在此展示</p>
                </div>
              </TableCell>
            </TableRow>

            <template v-else>
              <TableRow
                v-for="item in casesData.data"
                :key="item.id"
                class="cursor-pointer hover:bg-muted/50"
                @click="viewProject(item.id)"
              >
                <TableCell class="font-medium">
                  <div class="flex items-center gap-2">
                    <Star
                      v-if="item.favorited"
                      class="h-3.5 w-3.5 shrink-0 fill-amber-400 text-amber-400"
                    />
                    {{ item.name }}
                  </div>
                </TableCell>
                <TableCell>{{ item.customerName }}</TableCell>
                <TableCell>{{ item.exhibitionName || '-' }}</TableCell>
                <TableCell>{{ item.industry || '-' }}</TableCell>
                <TableCell>
                  <div class="flex flex-wrap gap-1">
                    <Badge
                      v-for="tag in item.tags.slice(0, 3)"
                      :key="tag.id"
                      variant="secondary"
                      class="text-xs px-1.5 py-0"
                      :style="
                        tag.color
                          ? {
                              backgroundColor: tag.color + '22',
                              borderColor: tag.color + '44',
                              color: tag.color,
                            }
                          : {}
                      "
                    >
                      {{ tag.name }}
                    </Badge>
                    <span
                      v-if="item.tags.length > 3"
                      class="text-xs text-muted-foreground"
                    >
                      +{{ item.tags.length - 3 }}
                    </span>
                  </div>
                </TableCell>
                <TableCell>{{ formatDate(item.archivedAt) }}</TableCell>
                <TableCell class="text-right" @click.stop>
                  <Button
                    variant="ghost"
                    size="sm"
                    @click="viewProject(item.id)"
                  >
                    查看
                  </Button>
                </TableCell>
              </TableRow>
            </template>
          </TableBody>
        </Table>
      </div>

      <div class="flex items-center justify-between px-4 py-3 border-t">
        <div class="text-sm text-muted-foreground">
          显示 {{ casesData?.data?.length || 0 }} 条结果
        </div>
        <div class="flex items-center space-x-2">
          <Button
            variant="outline"
            size="icon"
            :disabled="cursorStack.length === 0"
            @click="prevPage"
          >
            <ChevronLeft class="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            :disabled="!casesData?.page?.hasMore"
            @click="nextPage"
          >
            <ChevronRight class="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  </div>
</template>
