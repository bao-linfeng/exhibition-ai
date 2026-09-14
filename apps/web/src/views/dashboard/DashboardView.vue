<script setup lang="ts">
import { useAuth } from '../../composables/useAuth.js';
import { Building2, FolderKanban, Plus } from '@lucide/vue';
import { useRouter } from 'vue-router';
import { Button } from '../../components/ui/button/index.js';

const { user } = useAuth();
const router = useRouter();

function goTo(path: string) {
  router.push(path);
}
</script>

<template>
  <div class="space-y-6">
    <div class="mb-8">
      <h1 class="text-3xl font-bold tracking-tight text-foreground">
        下午好，{{ user?.displayName || '用户' }}
      </h1>
      <p class="text-muted-foreground mt-2">
        这里是展台 AI，您的智能设计助手和项目管理中心。
      </p>
    </div>

    <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      <!-- Welcome Card -->
      <div class="rounded-xl border bg-card text-card-foreground shadow-sm relative overflow-hidden group">
        <div class="p-6">
          <div class="flex items-center gap-4 mb-4">
            <div class="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
              <Building2 class="h-6 w-6 text-primary" />
            </div>
            <div>
              <h3 class="font-semibold text-lg">客户管理</h3>
              <p class="text-sm text-muted-foreground">管理客户信息，记录联系人</p>
            </div>
          </div>
          <div class="flex gap-3">
            <Button @click="goTo('/customers/new')" class="w-full">
              <Plus class="mr-2 h-4 w-4" />
              新建客户
            </Button>
            <Button @click="goTo('/customers')" variant="outline" class="w-full">
              查看全部
            </Button>
          </div>
        </div>
      </div>

      <!-- Quick Action Card -->
      <div class="rounded-xl border bg-card text-card-foreground shadow-sm relative overflow-hidden group">
        <div class="p-6">
          <div class="flex items-center gap-4 mb-4">
            <div class="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
              <FolderKanban class="h-6 w-6 text-primary" />
            </div>
            <div>
              <h3 class="font-semibold text-lg">项目管理</h3>
              <p class="text-sm text-muted-foreground">创建新项目，跟进设计进度</p>
            </div>
          </div>
          <div class="flex gap-3">
            <Button @click="goTo('/projects/new')" class="w-full">
              <Plus class="mr-2 h-4 w-4" />
              新建项目
            </Button>
            <Button @click="goTo('/projects')" variant="outline" class="w-full">
              查看全部
            </Button>
          </div>
        </div>
      </div>
      
      <!-- Stats Placeholder -->
      <div class="rounded-xl border bg-card text-card-foreground shadow-sm relative overflow-hidden flex flex-col justify-between">
        <div class="p-6">
          <h3 class="font-semibold text-lg mb-2">本月概览</h3>
          <div class="flex items-end justify-between mt-6">
            <div>
              <p class="text-sm text-muted-foreground mb-1">新增项目</p>
              <p class="text-3xl font-bold">--</p>
            </div>
            <div>
              <p class="text-sm text-muted-foreground mb-1">待审批</p>
              <p class="text-3xl font-bold">--</p>
            </div>
            <div>
              <p class="text-sm text-muted-foreground mb-1">已交付</p>
              <p class="text-3xl font-bold text-primary">--</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
