<script setup lang="ts">
import { ref, computed } from 'vue';
import { useRoute } from 'vue-router';
import { useQuery } from '@tanstack/vue-query';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/components/ui/toast';
import PageLoading from '@/components/PageLoading.vue';
import PageError from '@/components/PageError.vue';
import GenerationForm from '../generations/GenerationForm.vue';
import VersionGrid from '../image-versions/VersionGrid.vue';
import VersionCompare from '../image-versions/VersionCompare.vue';
import VersionTree from '../image-versions/VersionTree.vue';
import { apiClient } from '@/api/client.js';
import {
  listVersionsOptions,
  useUpdateSelectedVersion,
} from '@/api/queries/versions.js';
import { useCreateGeneration } from '@/api/queries/generations.js';
import type {
  ImageVersion,
  CreateGenerationRequest,
} from '@exhibition/contracts';

const route = useRoute();
const { toast } = useToast();
const projectId = computed(() => route.params.id as string);

// 获取项目信息
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

// 获取图片版本列表
const { data: versionsData, isLoading: versionsLoading } = useQuery(
  listVersionsOptions(projectId.value),
);

const versions = computed(
  () => (versionsData.value?.data ?? []) as ImageVersion[],
);

// 状态管理
const activeTab = ref<'grid' | 'tree'>('grid');
const showGenerationForm = ref(false);
const showCompareDialog = ref(false);
const generationMode = ref<'generate' | 'edit'>('generate');
const selectedParentVersion = ref<ImageVersion | null>(null);
const compareVersions = ref<{ a: ImageVersion; b: ImageVersion } | null>(null);

const selectedParentVersionId = computed<string | undefined>(
  () => selectedParentVersion.value?.id ?? undefined,
);

// Mutations
const updateSelectedVersion = useUpdateSelectedVersion();
const createGeneration = useCreateGeneration();

// 选中版本
async function handleSelectVersion(version: ImageVersion) {
  if (!project.value) return;

  try {
    await updateSelectedVersion.mutateAsync({
      projectId: projectId.value,
      body: {
        versionId: version.id as string,
        expectedRevision: project.value.revision as number,
      },
    });

    toast({
      title: '选图成功',
      description: `已选中版本 V${version.sequence}`,
    });
  } catch (error) {
    toast({
      title: '选图失败',
      description: error instanceof Error ? error.message : '未知错误',
      variant: 'destructive',
    });
  }
}

// 创建变体（修改图片）
function handleCreateVariation(version: ImageVersion) {
  selectedParentVersion.value = version;
  generationMode.value = 'edit';
  showGenerationForm.value = true;
}

// 提交生成/修改请求
async function handleSubmitGeneration(request: CreateGenerationRequest) {
  try {
    await createGeneration.mutateAsync({
      projectId: projectId.value,
      body: request,
    });

    toast({
      title: '任务已创建',
      description: '图片生成任务已提交，请稍候查看结果',
    });

    showGenerationForm.value = false;
    selectedParentVersion.value = null;
  } catch (error) {
    toast({
      title: '创建任务失败',
      description: error instanceof Error ? error.message : '未知错误',
      variant: 'destructive',
    });
  }
}

// 比较两个版本
function handleCompare(versionA: ImageVersion, versionB: ImageVersion) {
  compareVersions.value = { a: versionA, b: versionB };
  showCompareDialog.value = true;
}

// 查看版本详情
function handleViewDetails(version: ImageVersion) {
  // TODO: 实现版本详情查看
  console.log('View details:', version);
}
</script>

<template>
  <div class="flex h-full flex-col bg-slate-950">
    <PageLoading v-if="projectLoading || versionsLoading" />
    <PageError v-else-if="projectError" :error="projectError" />

    <div v-else class="flex flex-1 flex-col">
      <!-- 顶部工具栏 -->
      <div class="border-b border-slate-800 bg-slate-900 px-6 py-4">
        <div class="flex items-center justify-between">
          <div>
            <h1 class="text-xl font-semibold text-slate-100">
              {{ project?.name }}
            </h1>
            <p class="mt-1 text-sm text-slate-400">设计工作台</p>
          </div>

          <div class="flex items-center gap-2">
            <Button
              variant="outline"
              class="border-slate-700 bg-slate-900 hover:bg-slate-800"
              @click="activeTab = activeTab === 'grid' ? 'tree' : 'grid'"
            >
              {{ activeTab === 'grid' ? '树形视图' : '网格视图' }}
            </Button>
            <Button
              class="bg-cyan-600 hover:bg-cyan-700"
              @click="
                generationMode = 'generate';
                selectedParentVersion = null;
                showGenerationForm = true;
              "
            >
              新建生成
            </Button>
          </div>
        </div>
      </div>

      <!-- 主内容区 -->
      <div class="flex-1 overflow-auto p-6">
        <Tabs v-model="activeTab" class="h-full">
          <TabsList class="mb-4 bg-slate-900 border border-slate-800">
            <TabsTrigger value="grid">网格视图</TabsTrigger>
            <TabsTrigger value="tree">树形视图</TabsTrigger>
          </TabsList>

          <TabsContent value="grid" class="mt-0">
            <VersionGrid
              :versions="versions"
              :selected-version-id="project?.selectedVersionId ?? null"
              :loading="versionsLoading"
              @select="handleSelectVersion"
              @compare="handleCompare"
              @view-details="handleViewDetails"
              @create-variation="handleCreateVariation"
            />
          </TabsContent>

          <TabsContent value="tree" class="mt-0">
            <VersionTree
              :versions="versions"
              :selected-version-id="project?.selectedVersionId ?? null"
              @select="handleSelectVersion"
              @view-version="handleViewDetails"
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>

    <!-- 生成/修改表单对话框 -->
    <Dialog v-model:open="showGenerationForm">
      <DialogContent class="max-w-2xl border-slate-800 bg-slate-900">
        <DialogHeader>
          <DialogTitle class="text-slate-100">
            {{ generationMode === 'generate' ? '生成新图片' : '修改图片' }}
          </DialogTitle>
        </DialogHeader>

        <GenerationForm
          v-if="project"
          :project-id="projectId"
          :mode="generationMode"
          :brief-revision-id="project.currentBriefRevisionId ?? ''"
          :direction-id="undefined"
          :parent-version-id="selectedParentVersionId"
          :current-brief-revision-id="
            project.currentBriefRevisionId ?? undefined
          "
          :project-revision="project.revision"
          :disabled="createGeneration.isPending.value"
          @submit="handleSubmitGeneration"
          @cancel="showGenerationForm = false"
        />
      </DialogContent>
    </Dialog>

    <!-- 版本比较对话框 -->
    <Dialog v-model:open="showCompareDialog">
      <DialogContent class="max-w-4xl border-slate-800 bg-slate-900">
        <VersionCompare
          v-if="compareVersions"
          :version-a="compareVersions.a"
          :version-b="compareVersions.b"
          @close="showCompareDialog = false"
          @select="
            (version) => {
              handleSelectVersion(version);
              showCompareDialog = false;
            }
          "
        />
      </DialogContent>
    </Dialog>
  </div>
</template>
