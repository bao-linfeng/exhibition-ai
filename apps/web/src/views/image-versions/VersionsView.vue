<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { useQuery } from '@tanstack/vue-query';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import PageLoading from '@/components/PageLoading.vue';
import PageError from '@/components/PageError.vue';
import VersionGrid from './VersionGrid.vue';
import VersionTree from './VersionTree.vue';
import { listVersionsOptions } from '@/api/queries/versions.js';
import { apiClient } from '@/api/client.js';
import type { ImageVersion } from '@exhibition/contracts';

const route = useRoute();
const projectId = computed(() => route.params.id as string);

const {
  data: projectData,
  isLoading: projectLoading,
  error: projectError,
} = useQuery({
  queryKey: ['projects', 'detail', projectId],
  queryFn: async () => {
    const { data, error } = await apiClient.GET('/api/v1/projects/{id}', {
      params: { path: { id: projectId.value } },
    });
    if (error) throw new Error('Failed to fetch project');
    return data;
  },
});

const project = computed(() => projectData.value?.data);

const { data: versionsData, isLoading: versionsLoading } = useQuery(
  listVersionsOptions(projectId.value),
);

const versions = computed(() => {
  const data = versionsData.value?.data ?? [];
  return data as ImageVersion[];
});
</script>

<template>
  <div class="flex h-full flex-col bg-slate-950">
    <PageLoading v-if="projectLoading || versionsLoading" />
    <PageError v-else-if="projectError" :error="projectError" />

    <div v-else class="flex flex-1 flex-col">
      <div class="border-b border-slate-800 bg-slate-900 px-6 py-4">
        <h1 class="text-xl font-semibold text-slate-100">版本历史</h1>
        <p class="mt-1 text-sm text-slate-400">{{ project?.name }}</p>
      </div>

      <div class="flex-1 overflow-auto p-6">
        <Tabs default-value="grid">
          <TabsList class="mb-4">
            <TabsTrigger value="grid">网格视图</TabsTrigger>
            <TabsTrigger value="tree">树形视图</TabsTrigger>
          </TabsList>

          <TabsContent value="grid">
            <VersionGrid
              :versions="versions"
              :selected-version-id="project?.selectedVersionId ?? null"
              :loading="versionsLoading"
            />
          </TabsContent>

          <TabsContent value="tree">
            <VersionTree
              :versions="versions"
              :selected-version-id="project?.selectedVersionId ?? null"
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  </div>
</template>
