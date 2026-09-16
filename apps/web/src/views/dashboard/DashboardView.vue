<script setup lang="ts">
import { computed } from 'vue';
import { useAuth } from '../../composables/useAuth.js';
import {
  Building2,
  FolderKanban,
  Plus,
  Clock,
  Loader2,
  AlertCircle,
  ClipboardList,
} from '@lucide/vue';
import { useRouter } from 'vue-router';
import { Button } from '../../components/ui/button/index.js';
import { useDashboardSummaryQuery } from '../../api/queries/dashboard.js';
import StatusBadge from '../../components/StatusBadge.vue';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../components/ui/table/index.js';

const { user } = useAuth();
const router = useRouter();

const currentHour = new Date().getHours();
const greeting = computed(() => {
  if (currentHour < 12) return '上午好';
  if (currentHour < 18) return '下午好';
  return '晚上好';
});

const {
  data: summaryData,
  isLoading,
  isError,
  error,
} = useDashboardSummaryQuery();

function goTo(path: string) {
  router.push(path);
}

function formatDate(dateStr: string) {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  return new Intl.DateTimeFormat('zh-CN', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
  }).format(date);
}
</script>

<template>
  <div class="space-y-6">
    <div class="mb-8">
      <h1 class="text-3xl font-bold tracking-tight text-foreground">
        {{ greeting }}，{{ user?.displayName || '用户' }}
      </h1>
      <p class="text-muted-foreground mt-2">
        这里是展台 AI，您的智能设计助手和项目管理中心。
      </p>
    </div>

    <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <!-- Welcome Card -->
      <div
        class="rounded-xl border bg-card text-card-foreground shadow-sm relative overflow-hidden group"
      >
        <div class="p-6">
          <div class="flex items-center gap-4 mb-4">
            <div
              class="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center"
            >
              <Building2 class="h-6 w-6 text-primary" />
            </div>
            <div>
              <h3 class="font-semibold text-lg">客户管理</h3>
              <p class="text-sm text-muted-foreground">
                管理客户信息，记录联系人
              </p>
            </div>
          </div>
          <div class="flex gap-3">
            <Button class="w-full" @click="goTo('/customers/new')">
              <Plus class="mr-2 h-4 w-4" />
              新建客户
            </Button>
            <Button
              variant="outline"
              class="w-full"
              @click="goTo('/customers')"
            >
              查看全部
            </Button>
          </div>
        </div>
      </div>

      <!-- Quick Action Card -->
      <div
        class="rounded-xl border bg-card text-card-foreground shadow-sm relative overflow-hidden group"
      >
        <div class="p-6">
          <div class="flex items-center gap-4 mb-4">
            <div
              class="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center"
            >
              <FolderKanban class="h-6 w-6 text-primary" />
            </div>
            <div>
              <h3 class="font-semibold text-lg">项目管理</h3>
              <p class="text-sm text-muted-foreground">
                创建新项目，跟进设计进度
              </p>
            </div>
          </div>
          <div class="flex gap-3">
            <Button class="w-full" @click="goTo('/projects/new')">
              <Plus class="mr-2 h-4 w-4" />
              新建项目
            </Button>
            <Button variant="outline" class="w-full" @click="goTo('/projects')">
              查看全部
            </Button>
          </div>
        </div>
      </div>

      <!-- Stats Card -->
      <div
        class="rounded-xl border bg-card text-card-foreground shadow-sm relative overflow-hidden flex flex-col justify-between"
      >
        <div class="p-6">
          <h3 class="font-semibold text-lg mb-2">本月概览</h3>
          <div
            v-if="isLoading"
            class="flex items-center justify-center h-20 text-muted-foreground"
          >
            <Loader2 class="h-6 w-6 animate-spin mr-2" />
            <span>加载中...</span>
          </div>
          <div
            v-else-if="isError"
            class="flex flex-col items-center justify-center h-20 text-destructive text-sm"
          >
            <AlertCircle class="h-5 w-5 mb-1" />
            <span>{{ error?.message || '加载失败' }}</span>
          </div>
          <div v-else class="flex items-end justify-between mt-6">
            <div>
              <p class="text-sm text-muted-foreground mb-1">新增项目</p>
              <p class="text-3xl font-bold">
                {{ summaryData?.activeProjects ?? '--' }}
              </p>
            </div>
            <div>
              <p class="text-sm text-muted-foreground mb-1">待审批</p>
              <p class="text-3xl font-bold">
                {{ summaryData?.pendingReview ?? '--' }}
              </p>
            </div>
            <div>
              <p class="text-sm text-muted-foreground mb-1">已交付</p>
              <p class="text-3xl font-bold text-primary">
                {{ summaryData?.approvedThisMonth ?? '--' }}
              </p>
            </div>
          </div>
        </div>
      </div>

      <!-- Task Center Card -->
      <div
        class="rounded-xl border bg-card text-card-foreground shadow-sm relative overflow-hidden group"
      >
        <div class="p-6">
          <div class="flex items-center gap-4 mb-4">
            <div
              class="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center"
            >
              <ClipboardList class="h-6 w-6 text-primary" />
            </div>
            <div>
              <h3 class="font-semibold text-lg">任务中心</h3>
              <p class="text-sm text-muted-foreground">
                查看后台任务与运行状态
              </p>
            </div>
          </div>
          <div class="flex gap-3 mt-[1.35rem]">
            <Button
              v-if="(summaryData?.activeTasks ?? 0) > 0"
              class="w-full bg-blue-50 text-blue-600 hover:bg-blue-100 border border-blue-200"
              @click="goTo('/tasks')"
              variant="outline"
            >
              <Loader2 class="mr-2 h-4 w-4 animate-spin" />
              {{ summaryData?.activeTasks }} 个任务进行中
            </Button>
            <Button
              v-else
              variant="outline"
              class="w-full text-muted-foreground"
              @click="goTo('/tasks')"
            >
              暂无运行中任务
            </Button>
          </div>
        </div>
      </div>
    </div>

    <!-- Recent Projects Section -->
    <div class="mt-8">
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-xl font-semibold tracking-tight">最近项目</h2>
        <Button variant="ghost" size="sm" @click="goTo('/projects')">
          查看全部项目 <Plus class="ml-2 h-4 w-4 rotate-45" />
        </Button>
      </div>

      <div
        class="rounded-md border bg-card text-card-foreground shadow-sm overflow-hidden"
      >
        <div class="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>项目名称</TableHead>
                <TableHead>客户名称</TableHead>
                <TableHead>状态</TableHead>
                <TableHead class="text-right">更新时间</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow v-if="isLoading">
                <TableCell colspan="4" class="h-24 text-center">
                  <div
                    class="flex items-center justify-center text-muted-foreground"
                  >
                    <Loader2 class="h-5 w-5 animate-spin mr-2" />
                    加载中...
                  </div>
                </TableCell>
              </TableRow>

              <TableRow v-else-if="isError">
                <TableCell
                  colspan="4"
                  class="h-24 text-center text-destructive"
                >
                  获取最近项目失败
                </TableCell>
              </TableRow>

              <TableRow
                v-else-if="
                  !summaryData?.recentProjects ||
                  summaryData.recentProjects.length === 0
                "
              >
                <TableCell
                  colspan="4"
                  class="h-32 text-center text-muted-foreground"
                >
                  <div class="flex flex-col items-center justify-center">
                    <FolderKanban class="h-8 w-8 mb-2 opacity-50" />
                    <p>暂无近期项目</p>
                  </div>
                </TableCell>
              </TableRow>

              <template v-else>
                <TableRow
                  v-for="project in summaryData.recentProjects.slice(0, 5)"
                  :key="project.id"
                  class="cursor-pointer hover:bg-muted/50 transition-colors"
                  @click="goTo(`/projects/${project.id}`)"
                >
                  <TableCell class="font-medium">
                    {{ project.name }}
                  </TableCell>
                  <TableCell class="text-muted-foreground">
                    {{ project.customerName }}
                  </TableCell>
                  <TableCell>
                    <StatusBadge :status="project.status" />
                  </TableCell>
                  <TableCell class="text-right text-muted-foreground text-sm">
                    <div class="flex items-center justify-end gap-1.5">
                      <Clock class="h-3.5 w-3.5" />
                      {{ formatDate(project.updatedAt) }}
                    </div>
                  </TableCell>
                </TableRow>
              </template>
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  </div>
</template>
