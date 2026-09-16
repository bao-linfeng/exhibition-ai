<script setup lang="ts">
import { ref, computed } from 'vue';
import {
  useInfiniteUsersQuery,
  useUpdateUser,
} from '@/api/queries/settings.js';
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
import { Loader2, Edit2 } from '@lucide/vue';
import { useToast } from '@/components/ui/toast/index.js';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog/index.js';
import { Label } from '@/components/ui/label/index.js';
import type { User } from '@exhibition/contracts';

type UserRole = 'admin' | 'designer' | 'sales' | 'viewer';
type UserStatus = 'enabled' | 'disabled';

const { toast } = useToast();

const roleFilter = ref<UserRole | 'all'>('all');
const statusFilter = ref<UserStatus | 'all'>('all');

const queryParams = computed(() => ({
  role: roleFilter.value === 'all' ? undefined : roleFilter.value,
  status: statusFilter.value === 'all' ? undefined : statusFilter.value,
  limit: 20,
}));

const {
  data: usersData,
  isLoading,
  isError,
  error,
  fetchNextPage,
  hasNextPage,
  isFetchingNextPage,
} = useInfiniteUsersQuery(queryParams.value);

const users = computed(() => {
  return usersData.value?.pages.flatMap((page) => page.data) ?? [];
});

const updateUser = useUpdateUser();

const isEditDialogOpen = ref(false);
const editingUser = ref<User | null>(null);
const editForm = ref<{ role: UserRole; status: UserStatus }>({
  role: 'viewer',
  status: 'enabled',
});

function openEditDialog(user: User) {
  editingUser.value = user;
  editForm.value = {
    role: user.role,
    status: user.status,
  };
  isEditDialogOpen.value = true;
}

async function handleUpdateUser() {
  if (!editingUser.value) return;

  try {
    await updateUser.mutateAsync({
      id: editingUser.value.id,
      body: {
        role: editForm.value.role,
        status: editForm.value.status,
        expectedRevision: editingUser.value.revision,
      },
    });
    toast({ title: '用户更新成功' });
    isEditDialogOpen.value = false;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : '';
    if (message.includes('409') || message.includes('last admin')) {
      toast({
        title: '无法更新',
        variant: 'destructive',
        description: '系统必须保留至少一个启用的管理员账户。',
      });
    } else {
      toast({
        title: '更新失败',
        variant: 'destructive',
        description: message || '未知错误',
      });
    }
  }
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
  }).format(date);
}

function getRoleLabel(role: string) {
  const map: Record<string, string> = {
    admin: '管理员',
    designer: '设计师',
    sales: '销售',
    viewer: '访客',
  };
  return map[role] || role;
}

function getRoleVariant(role: string) {
  const map: Record<
    string,
    'default' | 'secondary' | 'destructive' | 'outline'
  > = {
    admin: 'default',
    designer: 'secondary',
    sales: 'outline',
    viewer: 'secondary',
  };
  return map[role] || 'outline';
}

function getRoleCustomClass(role: string) {
  const map: Record<string, string> = {
    admin:
      'bg-purple-500/15 text-purple-700 hover:bg-purple-500/25 border-purple-500/20',
    designer:
      'bg-blue-500/15 text-blue-700 hover:bg-blue-500/25 border-blue-500/20',
    sales:
      'bg-orange-500/15 text-orange-700 hover:bg-orange-500/25 border-orange-500/20',
    viewer:
      'bg-slate-500/15 text-slate-700 hover:bg-slate-500/25 border-slate-500/20',
  };
  return map[role] || '';
}

function getStatusLabel(status: string) {
  const map: Record<string, string> = {
    enabled: '已启用',
    disabled: '已禁用',
  };
  return map[status] || status;
}

function getStatusCustomClass(status: string) {
  if (status === 'enabled') {
    return 'bg-green-500/15 text-green-700 hover:bg-green-500/25 border-green-500/20';
  }
  return 'bg-slate-500/15 text-slate-500 hover:bg-slate-500/25 border-slate-500/20';
}
</script>

<template>
  <div class="h-full flex flex-col space-y-4">
    <div class="flex items-center gap-3 justify-end">
      <Select v-model="roleFilter">
        <SelectTrigger class="w-[160px]">
          <SelectValue placeholder="角色" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">所有角色</SelectItem>
          <SelectItem value="admin">管理员</SelectItem>
          <SelectItem value="designer">设计师</SelectItem>
          <SelectItem value="sales">销售</SelectItem>
          <SelectItem value="viewer">访客</SelectItem>
        </SelectContent>
      </Select>

      <Select v-model="statusFilter">
        <SelectTrigger class="w-[160px]">
          <SelectValue placeholder="状态" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">所有状态</SelectItem>
          <SelectItem value="enabled">已启用</SelectItem>
          <SelectItem value="disabled">已禁用</SelectItem>
        </SelectContent>
      </Select>
    </div>

    <div
      class="rounded-md border bg-card shadow-sm flex-1 flex flex-col min-h-0 overflow-hidden"
    >
      <div class="overflow-auto flex-1 relative">
        <Table>
          <TableHeader class="sticky top-0 bg-card z-10 shadow-sm">
            <TableRow>
              <TableHead>邮箱</TableHead>
              <TableHead>昵称</TableHead>
              <TableHead>角色</TableHead>
              <TableHead>状态</TableHead>
              <TableHead>创建时间</TableHead>
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
            <TableRow v-else-if="users.length === 0">
              <TableCell
                colspan="6"
                class="h-32 text-center text-muted-foreground"
              >
                没有找到用户
              </TableCell>
            </TableRow>
            <TableRow
              v-for="user in users"
              :key="user.id"
              class="hover:bg-muted/30"
              :class="{ 'opacity-60': user.status === 'disabled' }"
            >
              <TableCell class="font-medium">{{ user.email }}</TableCell>
              <TableCell>{{ user.displayName || '-' }}</TableCell>
              <TableCell>
                <Badge
                  :variant="getRoleVariant(user.role)"
                  :class="['border font-medium', getRoleCustomClass(user.role)]"
                >
                  {{ getRoleLabel(user.role) }}
                </Badge>
              </TableCell>
              <TableCell>
                <Badge
                  variant="outline"
                  :class="[
                    'border font-medium',
                    getStatusCustomClass(user.status),
                  ]"
                >
                  {{ getStatusLabel(user.status) }}
                </Badge>
              </TableCell>
              <TableCell class="text-sm text-muted-foreground">
                {{ formatTime(user.createdAt) }}
              </TableCell>
              <TableCell class="text-right">
                <Button variant="ghost" size="sm" @click="openEditDialog(user)">
                  <Edit2 class="w-4 h-4 mr-1" />
                  编辑
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

    <Dialog v-model:open="isEditDialogOpen">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>编辑用户</DialogTitle>
          <DialogDescription>
            修改用户 {{ editingUser?.email }} 的角色和状态。
          </DialogDescription>
        </DialogHeader>
        <div class="grid gap-4 py-4">
          <div class="grid grid-cols-4 items-center gap-4">
            <Label class="text-right">角色</Label>
            <div class="col-span-3">
              <Select v-model="editForm.role">
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">管理员</SelectItem>
                  <SelectItem value="designer">设计师</SelectItem>
                  <SelectItem value="sales">销售</SelectItem>
                  <SelectItem value="viewer">访客</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div class="grid grid-cols-4 items-center gap-4">
            <Label class="text-right">状态</Label>
            <div class="col-span-3">
              <Select v-model="editForm.status">
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="enabled">已启用</SelectItem>
                  <SelectItem value="disabled">已禁用</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            @click="isEditDialogOpen = false"
            :disabled="updateUser.isPending.value"
          >
            取消
          </Button>
          <Button
            @click="handleUpdateUser"
            :disabled="updateUser.isPending.value"
          >
            <Loader2
              v-if="updateUser.isPending.value"
              class="mr-2 h-4 w-4 animate-spin"
            />
            保存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
