<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useCustomersQuery } from '../../api/queries/customers.js';
import { Plus, Search, Building2, ChevronLeft, ChevronRight } from '@lucide/vue';
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
const statusFilter = ref<'active' | 'inactive' | undefined>(undefined);

watchDebounced(
  searchInput,
  (val) => {
    search.value = val;
  },
  { debounce: 300 }
);

const { data: customers, isLoading, isError, error } = useCustomersQuery({
  search: search.value,
  status: statusFilter.value,
});

function goToNewCustomer() {
  router.push('/customers/new');
}

function viewCustomer(id: string) {
  router.push(`/customers/${id}`);
}

function editCustomer(id: string) {
  router.push(`/customers/${id}/edit`);
}
</script>

<template>
  <div>
    <PageHeader title="客户管理" description="管理所有客户信息与联系方式">
      <template #actions>
        <Button @click="goToNewCustomer">
          <Plus class="mr-2 h-4 w-4" />
          新建客户
        </Button>
      </template>
    </PageHeader>

    <div class="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center">
      <div class="relative w-full max-w-sm">
        <Search class="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          v-model="searchInput"
          type="text"
          placeholder="搜索公司名称或联系人..."
          class="pl-9"
        />
      </div>
      <div class="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          :class="statusFilter === undefined ? 'bg-primary/10 border-primary/30' : ''"
          @click="statusFilter = undefined"
        >
          全部
        </Button>
        <Button
          variant="outline"
          size="sm"
          :class="statusFilter === 'active' ? 'bg-primary/10 border-primary/30' : ''"
          @click="statusFilter = 'active'"
        >
          活跃
        </Button>
        <Button
          variant="outline"
          size="sm"
          :class="statusFilter === 'inactive' ? 'bg-primary/10 border-primary/30' : ''"
          @click="statusFilter = 'inactive'"
        >
          非活跃
        </Button>
      </div>
    </div>

    <div class="rounded-md border bg-card text-card-foreground shadow-sm overflow-hidden">
      <div class="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>公司名称</TableHead>
              <TableHead>联系人</TableHead>
              <TableHead>联系电话</TableHead>
              <TableHead>行业</TableHead>
              <TableHead>状态</TableHead>
              <TableHead class="text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <LoadingRows v-if="isLoading" :columns="6" :rows="3" />
            
            <template v-else-if="isError">
              <TableRow>
                <TableCell colspan="6" class="h-24 text-center text-destructive">
                  获取客户列表失败: {{ error?.message || '未知错误' }}
                </TableCell>
              </TableRow>
            </template>
            
            <template v-else-if="!customers?.data || customers.data.length === 0">
              <TableRow>
                <TableCell colspan="6" class="h-32 text-center text-muted-foreground">
                  <div class="flex flex-col items-center justify-center">
                    <Building2 class="h-8 w-8 mb-2 opacity-50" />
                    <p>暂无客户数据</p>
                  </div>
                </TableCell>
              </TableRow>
            </template>
            
            <template v-else>
              <TableRow v-for="customer in customers.data" :key="customer.id" class="cursor-pointer hover:bg-muted/50" @click="viewCustomer(customer.id)">
                <TableCell class="font-medium">{{ customer.name }}</TableCell>
                <TableCell>{{ customer.contactName || '-' }}</TableCell>
                <TableCell>{{ customer.contactPhone || '-' }}</TableCell>
                <TableCell>{{ customer.industry || '-' }}</TableCell>
                <TableCell>
                  <StatusBadge :status="customer.status" />
                </TableCell>
                <TableCell class="text-right" @click.stop>
                  <Button variant="ghost" size="sm" @click="viewCustomer(customer.id)">查看</Button>
                  <Button variant="ghost" size="sm" @click="editCustomer(customer.id)">编辑</Button>
                </TableCell>
              </TableRow>
            </template>
          </TableBody>
        </Table>
      </div>
      
      <!-- Basic Pagination Placeholder -->
      <div class="flex items-center justify-between px-4 py-3 border-t">
        <div class="text-sm text-muted-foreground">
          显示 {{ customers?.data?.length || 0 }} 条结果
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
