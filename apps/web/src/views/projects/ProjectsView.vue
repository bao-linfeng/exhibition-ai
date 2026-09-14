<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useProjectsQuery } from '../../api/queries/projects.js';
import { Plus, Search, FolderKanban, ChevronLeft, ChevronRight } from '@lucide/vue';
import { watchDebounced } from '@vueuse/core';
import PageHeader from '../../components/PageHeader.vue';
import StatusBadge from '../../components/StatusBadge.vue';
import LoadingRows from '../../components/LoadingRows.vue';
import { Button } from '../../components/ui/button/index.js';
import { Input } from '../../components/ui/input/index.js';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../components/ui/table/index.js';

const router = useRouter();
const searchInput = ref('');
const search = ref('');
const statusFilter = ref<string | undefined>(undefined);

watchDebounced(
  searchInput,
  (val) => {
    search.value = val;
  },
  { debounce: 300 }
);

const { data: projectsData, isLoading, isError, error } = useProjectsQuery({
  search: search.value,
  status: statusFilter.value as any,
});

function goToNewProject() {
  router.push('/projects/new');
}

function viewProject(id: string) {
  router.push(`/projects/${id}`);
}
</script>

<template>
  <div>
    <PageHeader title="项目管理" description="跟进所有展台设计与交付项目">
      <template #actions>
        <Button @click="goToNewProject">
          <Plus class="mr-2 h-4 w-4" />
          新建项目
        </Button>
      </template>
    </PageHeader>

    <div class="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
      <div class="relative w-full max-w-sm">
        <Search class="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          v-model="searchInput"
          type="text"
          placeholder="搜索项目名称..."
          class="pl-9"
        />
      </div>
      <div class="flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          :class="statusFilter === undefined ? 'bg-primary/10 border-primary/30' : ''"
          @click="statusFilter = undefined"
        >
          全部
        </Button>
        <Button
          v-for="status in ['draft', 'briefing', 'designing', 'reviewing', 'approved', 'archived']"
          :key="status"
          variant="outline"
          size="sm"
          :class="statusFilter === status ? 'bg-primary/10 border-primary/30' : ''"
          @click="statusFilter = status"
        >
          {{ 
            status === 'draft' ? '草稿' : 
            status === 'briefing' ? '需求确认' : 
            status === 'designing' ? '设计中' : 
            status === 'reviewing' ? '审核中' : 
            status === 'approved' ? '已通过' : '已归档'
          }}
        </Button>
      </div>
    </div>

    <div class="rounded-md border bg-card text-card-foreground shadow-sm overflow-hidden">
      <div class="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>项目名称</TableHead>
              <TableHead>客户名称</TableHead>
              <TableHead>负责人</TableHead>
              <TableHead>展会日期</TableHead>
              <TableHead>状态</TableHead>
              <TableHead class="text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <LoadingRows v-if="isLoading" :columns="6" :rows="3" />
            
            <template v-else-if="isError">
              <TableRow>
                <TableCell colspan="6" class="h-24 text-center text-destructive">
                  获取项目列表失败: {{ error?.message || '未知错误' }}
                </TableCell>
              </TableRow>
            </template>
            
            <template v-else-if="!projectsData?.data || projectsData.data.length === 0">
              <TableRow>
                <TableCell colspan="6" class="h-32 text-center text-muted-foreground">
                  <div class="flex flex-col items-center justify-center">
                    <FolderKanban class="h-8 w-8 mb-2 opacity-50" />
                    <p>暂无项目数据</p>
                  </div>
                </TableCell>
              </TableRow>
            </template>
            
            <template v-else>
              <TableRow v-for="project in projectsData.data" :key="project.id" class="cursor-pointer hover:bg-muted/50" @click="viewProject(project.id)">
                <TableCell class="font-medium">{{ project.name }}</TableCell>
                <TableCell>{{ project.customerName }}</TableCell>
                <TableCell>{{ project.ownerName }}</TableCell>
                <TableCell>{{ project.exhibitionDate || '-' }}</TableCell>
                <TableCell>
                  <StatusBadge :status="project.status" />
                </TableCell>
                <TableCell class="text-right" @click.stop>
                  <Button variant="ghost" size="sm" @click="viewProject(project.id)">查看</Button>
                </TableCell>
              </TableRow>
            </template>
          </TableBody>
        </Table>
      </div>
      
      <!-- Pagination -->
      <div class="flex items-center justify-between px-4 py-3 border-t">
        <div class="text-sm text-muted-foreground">
          显示 {{ projectsData?.data?.length || 0 }} 条结果
        </div>
        <div class="flex items-center space-x-2">
          <Button variant="outline" size="icon" disabled>
            <ChevronLeft class="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" disabled>
            <ChevronRight class="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  </div>
</template>
