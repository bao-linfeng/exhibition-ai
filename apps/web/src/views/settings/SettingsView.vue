<script setup lang="ts">
import { useUserStore } from '@/stores/user.js';
import PageForbidden from '@/components/PageForbidden.vue';
import PageHeader from '@/components/PageHeader.vue';

import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs/index.js';

import UsersTab from './components/UsersTab.vue';
import ModelsTab from './components/ModelsTab.vue';
import PromptsTab from './components/PromptsTab.vue';
import QuotaTab from './components/QuotaTab.vue';
import AuditTab from './components/AuditTab.vue';

const userStore = useUserStore();
</script>

<template>
  <div v-if="!userStore.isAdmin" class="h-full">
    <PageForbidden />
  </div>
  <div v-else class="h-full flex flex-col space-y-6">
    <PageHeader title="系统设置" />

    <div class="flex-1 min-h-0">
      <Tabs defaultValue="users" class="w-full h-full flex flex-col">
        <TabsList class="w-fit">
          <TabsTrigger value="users">用户管理</TabsTrigger>
          <TabsTrigger value="models">模型配置</TabsTrigger>
          <TabsTrigger value="prompts">Prompt 模板</TabsTrigger>
          <TabsTrigger value="quota">系统额度</TabsTrigger>
          <TabsTrigger value="audit">审计日志</TabsTrigger>
        </TabsList>
        <div class="flex-1 mt-4 relative">
          <TabsContent value="users" class="absolute inset-0 m-0 outline-none">
            <UsersTab />
          </TabsContent>
          <TabsContent value="models" class="absolute inset-0 m-0 outline-none">
            <ModelsTab />
          </TabsContent>
          <TabsContent
            value="prompts"
            class="absolute inset-0 m-0 outline-none"
          >
            <PromptsTab />
          </TabsContent>
          <TabsContent value="quota" class="absolute inset-0 m-0 outline-none">
            <QuotaTab />
          </TabsContent>
          <TabsContent value="audit" class="absolute inset-0 m-0 outline-none">
            <AuditTab />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  </div>
</template>
