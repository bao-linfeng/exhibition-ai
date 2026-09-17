<script setup lang="ts">
import { ref, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useQuery } from '@tanstack/vue-query';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { Loader2, Download, FileText } from '@lucide/vue';
import PageLoading from '@/components/PageLoading.vue';
import PageError from '@/components/PageError.vue';
import VersionGrid from './VersionGrid.vue';
import VersionTree from './VersionTree.vue';
import { listVersionsOptions } from '@/api/queries/versions.js';
import { useCreateExport } from '@/api/queries/exports.js';
import { apiClient } from '@/api/client.js';
import type { ImageVersion } from '@exhibition/contracts';

const route = useRoute();
const router = useRouter();
const { toast } = useToast();
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

const selectedVersionIds = ref<string[]>([]);

const createExport = useCreateExport();
const exportingFormat = ref<'zip' | 'pdf' | null>(null);

async function handleExport(format: 'zip' | 'pdf') {
  if (selectedVersionIds.value.length === 0) return;

  exportingFormat.value = format;
  try {
    await createExport.mutateAsync({
      projectId: projectId.value,
      versionIds: selectedVersionIds.value,
      format,
    });
    toast({
      title: '导出任务已创建',
      description: '正在后台处理，完成后可下载。',
    });
    router.push(`/projects/${projectId.value}/exports`);
  } catch (err) {
    toast({
      title: '创建导出失败',
      variant: 'destructive',
      description: err instanceof Error ? err.message : '未知错误',
    });
  } finally {
    exportingFormat.value = null;
  }
}

function handleSelectionChange(ids: string[]) {
  selectedVersionIds.value = ids;
}
</script>

<template>
  <div class="flex h-full flex-col bg-slate-950">
    <PageLoading v-if="projectLoading || versionsLoading" />
    <PageError v-else-if="projectError" :error="projectError" />

    <div v-else class="flex flex-1 flex-col">
      <div
        class="flex items-center justify-between border-b border-slate-800 bg-slate-900 px-6 py-4"
      >
        <div>
          <h1 class="text-xl font-semibold text-slate-100">版本历史</h1>
          <p class="mt-1 text-sm text-slate-400">{{ project?.name }}</p>
        </div>

        <div class="flex items-center gap-3">
          <Button
            variant="secondary"
            @click="router.push(`/projects/${projectId}/exports`)"
          >
            查看导出历史
          </Button>

          <template v-if="selectedVersionIds.length > 0">
            <Button
              variant="outline"
              @click="handleExport('zip')"
              :disabled="exportingFormat !== null"
              class="border-slate-600 text-slate-300 hover:bg-slate-800"
            >
              <Loader2
                v-if="exportingFormat === 'zip'"
                class="mr-2 h-4 w-4 animate-spin"
              />
              <Download v-else class="mr-2 h-4 w-4" />
              导出 ZIP
            </Button>
            <Button
              @click="handleExport('pdf')"
              :disabled="exportingFormat !== null"
              class="bg-cyan-600 hover:bg-cyan-700 text-white"
            >
              <Loader2
                v-if="exportingFormat === 'pdf'"
                class="mr-2 h-4 w-4 animate-spin"
              />
              <FileText v-else class="mr-2 h-4 w-4" />
              导出 PDF
            </Button>
          </template>
        </div>
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
              :export-selected-ids="selectedVersionIds"
              @update:export-selected-ids="handleSelectionChange"
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
