<script setup lang="ts">
import { ref, computed, onUnmounted, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useQuery, useQueryClient } from '@tanstack/vue-query';
import { useWindowSize } from '@vueuse/core';

import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { useToast } from '@/components/ui/toast';

import PageLoading from '@/components/PageLoading.vue';
import PageError from '@/components/PageError.vue';
import GenerationForm from '../generations/GenerationForm.vue';
import VersionGrid from '../image-versions/VersionGrid.vue';
import VersionCompare from '../image-versions/VersionCompare.vue';
import VersionTree from '../image-versions/VersionTree.vue';

import WorkspaceBriefPanel from './WorkspaceBriefPanel.vue';
import WorkspaceAssetsPanel from './WorkspaceAssetsPanel.vue';
import WorkspaceTasksPanel from './WorkspaceTasksPanel.vue';
import WorkspaceAgentPlaceholder from './WorkspaceAgentPlaceholder.vue';

import { apiClient } from '@/api/client.js';
import { useProjectEvents } from '@/composables/useProjectEvents.js';
import { listTasksOptions } from '@/api/queries/tasks.js';
import {
  listVersionsOptions,
  useUpdateSelectedVersion,
  versionKeys,
} from '@/api/queries/versions.js';
import { useCreateGeneration } from '@/api/queries/generations.js';
import type {
  ImageVersion,
  CreateGenerationRequest,
} from '@exhibition/contracts';

import {
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  FileText,
  LayoutPanelLeft,
  ListTodo,
  Plus,
} from '@lucide/vue';

const route = useRoute();
const queryClient = useQueryClient();
const { toast } = useToast();
const projectId = computed(() => route.params.id as string);

const { width: windowWidth } = useWindowSize();

// 响应式断点逻辑
// >=1440px: 3栏全开 (lg/xl 统称)
// >=1024px: 中栏+左/右可折叠
// >=768px: 中栏，左右抽屉
// <768px: 底部Tab
const isDesktop = computed(() => windowWidth.value >= 1440);
const isTablet = computed(
  () => windowWidth.value >= 1024 && windowWidth.value < 1440,
);
const isSmallTablet = computed(
  () => windowWidth.value >= 768 && windowWidth.value < 1024,
);
const isMobile = computed(() => windowWidth.value < 768);

// 面板折叠状态（1024-1439px时可用）
const leftPanelOpen = ref(true);
const rightPanelOpen = ref(true);

// 自动根据屏幕宽度调整初始折叠状态
watch(
  isDesktop,
  (val) => {
    if (val) {
      leftPanelOpen.value = true;
      rightPanelOpen.value = true;
    }
  },
  { immediate: true },
);

watch(isTablet, (val) => {
  if (val) {
    // 默认折叠右侧，保留左侧
    leftPanelOpen.value = true;
    rightPanelOpen.value = false;
  }
});

// SSE 订阅
const { status: sseStatus } = useProjectEvents({
  projectId: projectId.value,
  onEvent: (event) => {
    if (event.type === 'task.updated' || event.type === 'version.created') {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({
        queryKey: versionKeys.list(projectId.value),
      });
    }
  },
});

const { data: tasksData } = useQuery(
  listTasksOptions({ projectId: projectId.value, limit: 100 }, 5000),
);
const activeTasksCount = computed(() => {
  const activeStatuses = ['pending', 'queued', 'running', 'reconciling'];
  const tasks = tasksData.value?.data ?? [];
  return tasks.filter((t) => activeStatuses.includes(t.status)).length;
});

// 项目数据
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

// 版本数据
const { data: versionsData, isLoading: versionsLoading } = useQuery(
  listVersionsOptions(projectId.value),
);
const versions = computed(
  () => (versionsData.value?.data ?? []) as ImageVersion[],
);

// 状态
const centerTab = ref<'grid' | 'tree'>('grid');
const leftTab = ref<'brief' | 'assets'>('brief');
const rightTab = ref<'tasks' | 'agent'>('tasks');
const mobileTab = ref<'middle' | 'left' | 'right'>('middle');

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

// 清理逻辑
onUnmounted(() => {
  showGenerationForm.value = false;
  showCompareDialog.value = false;
  selectedParentVersion.value = null;
  compareVersions.value = null;
});

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

function handleCreateVariation(version: ImageVersion) {
  selectedParentVersion.value = version;
  generationMode.value = 'edit';
  showGenerationForm.value = true;
}

async function handleSubmitGeneration(request: CreateGenerationRequest) {
  try {
    await createGeneration.mutateAsync({
      projectId: projectId.value,
      body: request,
    });
    toast({
      title: '任务已创建',
      description: '图片生成任务已提交，稍后查看结果',
    });
    showGenerationForm.value = false;
    selectedParentVersion.value = null;
  } catch (error) {
    toast({
      title: '创建生成失败',
      description: error instanceof Error ? error.message : '未知错误',
      variant: 'destructive',
    });
  }
}

function handleCompare(versionA: ImageVersion, versionB: ImageVersion) {
  compareVersions.value = { a: versionA, b: versionB };
  showCompareDialog.value = true;
}

function handleViewDetails(version: ImageVersion) {
  console.log('View details:', version);
}
</script>

<template>
  <div
    class="flex h-[calc(100vh-4rem)] w-full flex-col bg-slate-950 overflow-hidden text-slate-100"
  >
    <PageLoading v-if="projectLoading || versionsLoading" />
    <PageError v-else-if="projectError" :error="projectError" />

    <div v-else class="flex flex-1 overflow-hidden relative">
      <!-- 移动端视图 (<768px): 使用底部导航 -->
      <template v-if="isMobile">
        <div class="flex-1 flex flex-col h-full overflow-hidden w-full pb-14">
          <!-- 动态渲染当前选中的主区域 -->
          <div v-if="mobileTab === 'left'" class="flex-1 overflow-hidden">
            <Tabs v-model="leftTab" class="h-full flex flex-col">
              <TabsList
                class="w-full bg-slate-900 border-b border-slate-800 rounded-none h-12"
              >
                <TabsTrigger value="brief" class="flex-1">Brief</TabsTrigger>
                <TabsTrigger value="assets" class="flex-1">素材</TabsTrigger>
              </TabsList>
              <div class="flex-1 overflow-hidden">
                <WorkspaceBriefPanel
                  v-if="leftTab === 'brief'"
                  :project-id="projectId"
                />
                <WorkspaceAssetsPanel
                  v-if="leftTab === 'assets'"
                  :project-id="projectId"
                />
              </div>
            </Tabs>
          </div>

          <div v-else-if="mobileTab === 'right'" class="flex-1 overflow-hidden">
            <Tabs v-model="rightTab" class="h-full flex flex-col">
              <TabsList
                class="w-full bg-slate-900 border-b border-slate-800 rounded-none h-12"
              >
                <TabsTrigger value="tasks" class="flex-1">任务</TabsTrigger>
                <TabsTrigger value="agent" class="flex-1">会话</TabsTrigger>
              </TabsList>
              <div class="flex-1 overflow-hidden">
                <WorkspaceTasksPanel
                  v-if="rightTab === 'tasks'"
                  :project-id="projectId"
                />
                <WorkspaceAgentPlaceholder v-if="rightTab === 'agent'" />
              </div>
            </Tabs>
          </div>

          <div v-else class="flex-1 flex flex-col overflow-hidden">
            <!-- 移动端中栏顶部工具栏 -->
            <div
              class="border-b border-slate-800 bg-slate-900 px-4 py-3 flex items-center justify-between shrink-0"
            >
              <div class="flex items-center gap-2">
                <div
                  class="w-2 h-2 rounded-full"
                  :class="
                    sseStatus === 'connected' ? 'bg-green-500' : 'bg-slate-500'
                  "
                  :title="sseStatus === 'connected' ? '已连接' : '未连接'"
                ></div>
                <h1 class="text-base font-semibold truncate max-w-[120px]">
                  {{ project?.name }}
                </h1>
              </div>
              <div class="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  class="h-8 border-slate-700 bg-slate-900 px-2"
                  @click="centerTab = centerTab === 'grid' ? 'tree' : 'grid'"
                  aria-label="切换视图"
                >
                  <LayoutPanelLeft class="w-4 h-4" />
                </Button>
                <Button
                  size="sm"
                  class="h-8 bg-cyan-600 hover:bg-cyan-700 px-2"
                  @click="
                    generationMode = 'generate';
                    selectedParentVersion = null;
                    showGenerationForm = true;
                  "
                  aria-label="新建生成"
                >
                  <Plus class="w-4 h-4" />
                </Button>
              </div>
            </div>
            <!-- 移动端中栏内容 -->
            <div class="flex-1 overflow-hidden bg-slate-950 p-2">
              <VersionGrid
                v-if="centerTab === 'grid'"
                :versions="versions"
                :selected-version-id="project?.selectedVersionId ?? null"
                :loading="versionsLoading"
                @select="handleSelectVersion"
                @compare="handleCompare"
                @view-details="handleViewDetails"
                @create-variation="handleCreateVariation"
              />
              <VersionTree
                v-else
                :versions="versions"
                :selected-version-id="project?.selectedVersionId ?? null"
                @select="handleSelectVersion"
                @view-version="handleViewDetails"
              />
            </div>
          </div>
        </div>

        <!-- 移动端底部 Tab 栏 -->
        <div
          class="absolute bottom-0 left-0 right-0 h-14 bg-slate-900 border-t border-slate-800 flex items-center justify-around z-10 px-2"
        >
          <button
            class="flex flex-col items-center justify-center w-16 h-full gap-1"
            :class="mobileTab === 'left' ? 'text-cyan-500' : 'text-slate-400'"
            @click="mobileTab = 'left'"
            aria-label="项目资料"
          >
            <FileText class="w-5 h-5" />
            <span class="text-[10px]">资料</span>
          </button>
          <button
            class="flex flex-col items-center justify-center w-16 h-full gap-1"
            :class="mobileTab === 'middle' ? 'text-cyan-500' : 'text-slate-400'"
            @click="mobileTab = 'middle'"
            aria-label="画板"
          >
            <LayoutPanelLeft class="w-5 h-5" />
            <span class="text-[10px]">画板</span>
          </button>
          <button
            class="flex flex-col items-center justify-center w-16 h-full gap-1 relative"
            :class="mobileTab === 'right' ? 'text-cyan-500' : 'text-slate-400'"
            @click="mobileTab = 'right'"
            aria-label="任务状态"
          >
            <ListTodo class="w-5 h-5" />
            <span class="text-[10px]">任务</span>
            <span
              v-if="activeTasksCount > 0"
              class="absolute top-1 right-2 w-2 h-2 rounded-full bg-blue-500"
            ></span>
          </button>
        </div>
      </template>

      <!-- 平板及桌面端视图 (>=768px): 三栏布局 (抽屉/折叠) -->
      <template v-else>
        <!-- 左栏 (Brief & 素材) -->
        <div
          v-if="isDesktop || (isTablet && leftPanelOpen)"
          class="w-[320px] shrink-0 border-r border-slate-800 bg-slate-900 flex flex-col h-full z-10 transition-all duration-300"
        >
          <Tabs v-model="leftTab" class="h-full flex flex-col">
            <div
              class="flex items-center justify-between border-b border-slate-800 pr-2"
            >
              <TabsList
                class="bg-transparent border-0 rounded-none h-12 w-full justify-start p-0"
              >
                <TabsTrigger
                  value="brief"
                  class="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-cyan-500 rounded-none h-full px-4 data-[state=active]:shadow-none"
                  >Brief</TabsTrigger
                >
                <TabsTrigger
                  value="assets"
                  class="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-cyan-500 rounded-none h-full px-4 data-[state=active]:shadow-none"
                  >素材</TabsTrigger
                >
              </TabsList>
              <Button
                v-if="!isDesktop"
                variant="ghost"
                size="sm"
                class="h-8 w-8 p-0 text-slate-400 hover:text-slate-300"
                @click="leftPanelOpen = false"
                aria-label="收起左栏"
              >
                <PanelLeftClose class="w-4 h-4" />
              </Button>
            </div>
            <div class="flex-1 overflow-hidden bg-slate-900/50">
              <WorkspaceBriefPanel
                v-if="leftTab === 'brief'"
                :project-id="projectId"
              />
              <WorkspaceAssetsPanel
                v-if="leftTab === 'assets'"
                :project-id="projectId"
              />
            </div>
          </Tabs>
        </div>

        <!-- 小平板左侧抽屉 (768-1023px) -->
        <Sheet v-if="isSmallTablet" v-model:open="leftPanelOpen">
          <SheetContent
            side="left"
            class="w-[320px] p-0 border-slate-800 bg-slate-900 sm:max-w-none"
          >
            <SheetHeader class="sr-only"
              ><SheetTitle>项目资料</SheetTitle></SheetHeader
            >
            <Tabs v-model="leftTab" class="h-full flex flex-col">
              <TabsList
                class="w-full bg-slate-900 border-b border-slate-800 rounded-none h-14 pt-2"
              >
                <TabsTrigger value="brief" class="flex-1">Brief</TabsTrigger>
                <TabsTrigger value="assets" class="flex-1">素材</TabsTrigger>
              </TabsList>
              <div class="flex-1 overflow-hidden">
                <WorkspaceBriefPanel
                  v-if="leftTab === 'brief'"
                  :project-id="projectId"
                />
                <WorkspaceAssetsPanel
                  v-if="leftTab === 'assets'"
                  :project-id="projectId"
                />
              </div>
            </Tabs>
          </SheetContent>
        </Sheet>

        <!-- 中栏 (主画板) -->
        <div class="flex-1 flex flex-col h-full min-w-0 bg-slate-950 relative">
          <!-- 顶部工具栏 -->
          <div
            class="h-14 border-b border-slate-800 bg-slate-900/80 backdrop-blur-sm px-4 flex items-center justify-between shrink-0"
          >
            <div class="flex items-center gap-3">
              <!-- 打开左栏按钮 -->
              <Button
                v-if="isTablet && !leftPanelOpen"
                variant="ghost"
                size="sm"
                class="h-8 w-8 p-0 text-slate-400 hover:text-slate-300"
                @click="leftPanelOpen = true"
                aria-label="展开左栏"
              >
                <PanelLeftOpen class="w-5 h-5" />
              </Button>
              <SheetTrigger
                v-if="isSmallTablet"
                asChild
                @click="leftPanelOpen = true"
              >
                <Button
                  variant="ghost"
                  size="sm"
                  class="h-8 w-8 p-0 text-slate-400"
                  aria-label="打开资料抽屉"
                >
                  <PanelLeftOpen class="w-5 h-5" />
                </Button>
              </SheetTrigger>

              <div>
                <h1
                  class="text-sm font-semibold text-slate-100 flex items-center gap-2"
                >
                  {{ project?.name }}
                  <span
                    class="text-xs font-normal text-slate-500 bg-slate-800 px-2 py-0.5 rounded-full flex items-center gap-1"
                  >
                    <div
                      class="w-1.5 h-1.5 rounded-full"
                      :class="
                        sseStatus === 'connected'
                          ? 'bg-green-500'
                          : 'bg-slate-500'
                      "
                    ></div>
                    {{ sseStatus === 'connected' ? '已同步' : '未连接' }}
                  </span>
                </h1>
              </div>
            </div>

            <div class="flex items-center gap-2">
              <!-- 视图切换 -->
              <div
                class="bg-slate-800 rounded-md p-0.5 flex items-center border border-slate-700"
              >
                <button
                  class="px-3 py-1 text-xs rounded-sm transition-colors"
                  :class="
                    centerTab === 'grid'
                      ? 'bg-slate-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-300'
                  "
                  @click="centerTab = 'grid'"
                  aria-label="网格视图"
                >
                  网格
                </button>
                <button
                  class="px-3 py-1 text-xs rounded-sm transition-colors"
                  :class="
                    centerTab === 'tree'
                      ? 'bg-slate-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-300'
                  "
                  @click="centerTab = 'tree'"
                  aria-label="树形视图"
                >
                  树形
                </button>
              </div>

              <div class="w-px h-4 bg-slate-700 mx-1"></div>

              <Button
                class="h-8 bg-cyan-600 hover:bg-cyan-700 text-xs px-3"
                @click="
                  generationMode = 'generate';
                  selectedParentVersion = null;
                  showGenerationForm = true;
                "
                aria-label="新建生成"
              >
                <Plus class="w-3.5 h-3.5 mr-1" /> 新建生成
              </Button>

              <!-- 打开右栏按钮 -->
              <Button
                v-if="isTablet && !rightPanelOpen"
                variant="ghost"
                size="sm"
                class="h-8 w-8 p-0 text-slate-400 hover:text-slate-300 ml-2 relative"
                @click="rightPanelOpen = true"
                aria-label="展开右栏"
              >
                <PanelRightOpen class="w-5 h-5" />
                <span
                  v-if="activeTasksCount > 0"
                  class="absolute top-1 right-1 w-2 h-2 rounded-full bg-blue-500"
                ></span>
              </Button>
              <SheetTrigger
                v-if="isSmallTablet"
                asChild
                @click="rightPanelOpen = true"
              >
                <Button
                  variant="ghost"
                  size="sm"
                  class="h-8 w-8 p-0 text-slate-400 ml-2 relative"
                  aria-label="打开任务抽屉"
                >
                  <PanelRightOpen class="w-5 h-5" />
                  <span
                    v-if="activeTasksCount > 0"
                    class="absolute top-1 right-1 w-2 h-2 rounded-full bg-blue-500"
                  ></span>
                </Button>
              </SheetTrigger>
            </div>
          </div>

          <!-- 画板内容 -->
          <div class="flex-1 overflow-auto p-6">
            <VersionGrid
              v-if="centerTab === 'grid'"
              :versions="versions"
              :selected-version-id="project?.selectedVersionId ?? null"
              :loading="versionsLoading"
              @select="handleSelectVersion"
              @compare="handleCompare"
              @view-details="handleViewDetails"
              @create-variation="handleCreateVariation"
            />
            <VersionTree
              v-else
              :versions="versions"
              :selected-version-id="project?.selectedVersionId ?? null"
              @select="handleSelectVersion"
              @view-version="handleViewDetails"
            />
          </div>
        </div>

        <!-- 右栏 (任务 & 会话) -->
        <div
          v-if="isDesktop || (isTablet && rightPanelOpen)"
          class="w-[320px] shrink-0 border-l border-slate-800 bg-slate-900 flex flex-col h-full z-10 transition-all duration-300"
        >
          <Tabs v-model="rightTab" class="h-full flex flex-col">
            <div
              class="flex items-center justify-between border-b border-slate-800 pl-2"
            >
              <Button
                v-if="!isDesktop"
                variant="ghost"
                size="sm"
                class="h-8 w-8 p-0 text-slate-400 hover:text-slate-300"
                @click="rightPanelOpen = false"
                aria-label="收起右栏"
              >
                <PanelRightClose class="w-4 h-4" />
              </Button>
              <TabsList
                class="bg-transparent border-0 rounded-none h-12 w-full justify-end p-0"
              >
                <TabsTrigger
                  value="tasks"
                  class="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-cyan-500 rounded-none h-full px-4 data-[state=active]:shadow-none flex gap-2 items-center"
                >
                  任务
                  <span
                    v-if="activeTasksCount > 0"
                    class="flex h-5 w-5 items-center justify-center rounded-full bg-blue-500/10 text-xs text-blue-400"
                    >{{ activeTasksCount }}</span
                  >
                </TabsTrigger>
                <TabsTrigger
                  value="agent"
                  class="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-cyan-500 rounded-none h-full px-4 data-[state=active]:shadow-none"
                  >会话</TabsTrigger
                >
              </TabsList>
            </div>
            <div class="flex-1 overflow-hidden bg-slate-900/50">
              <WorkspaceTasksPanel
                v-if="rightTab === 'tasks'"
                :project-id="projectId"
              />
              <WorkspaceAgentPlaceholder v-if="rightTab === 'agent'" />
            </div>
          </Tabs>
        </div>

        <!-- 小平板右侧抽屉 (768-1023px) -->
        <Sheet v-if="isSmallTablet" v-model:open="rightPanelOpen">
          <SheetContent
            side="right"
            class="w-[320px] p-0 border-slate-800 bg-slate-900 sm:max-w-none"
          >
            <SheetHeader class="sr-only"
              ><SheetTitle>任务与助手</SheetTitle></SheetHeader
            >
            <Tabs v-model="rightTab" class="h-full flex flex-col">
              <TabsList
                class="w-full bg-slate-900 border-b border-slate-800 rounded-none h-14 pt-2"
              >
                <TabsTrigger
                  value="tasks"
                  class="flex-1 flex gap-2 items-center"
                >
                  任务
                  <span
                    v-if="activeTasksCount > 0"
                    class="flex h-5 w-5 items-center justify-center rounded-full bg-blue-500/10 text-xs text-blue-400"
                    >{{ activeTasksCount }}</span
                  >
                </TabsTrigger>
                <TabsTrigger value="agent" class="flex-1">会话</TabsTrigger>
              </TabsList>
              <div class="flex-1 overflow-hidden">
                <WorkspaceTasksPanel
                  v-if="rightTab === 'tasks'"
                  :project-id="projectId"
                />
                <WorkspaceAgentPlaceholder v-if="rightTab === 'agent'" />
              </div>
            </Tabs>
          </SheetContent>
        </Sheet>
      </template>
    </div>

    <!-- 生成/修改表单对话框 -->
    <Dialog v-model:open="showGenerationForm">
      <DialogContent class="max-w-2xl border-slate-800 bg-slate-900">
        <DialogHeader>
          <DialogTitle class="text-slate-100">{{
            generationMode === 'generate' ? '新建生成图片' : '修改图片'
          }}</DialogTitle>
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
      <DialogContent
        class="max-w-4xl border-slate-800 bg-slate-900 p-0 overflow-hidden"
      >
        <DialogHeader class="sr-only"
          ><DialogTitle>版本对比</DialogTitle></DialogHeader
        >
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
