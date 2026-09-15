<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useProjectQuery } from '../../api/queries/projects.js';
import { useBriefQuery } from '../../api/queries/briefs.js';
import {
  useDirectionsQuery,
  useCreateDirectionsMutation,
} from '../../api/queries/directions.js';
import { useUserStore } from '../../stores/user.js';
import PageHeader from '../../components/PageHeader.vue';
import { Button } from '../../components/ui/button/index.js';
import { Badge } from '../../components/ui/badge/index.js';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog/index.js';
import {
  ChevronRight,
  Compass,
  Wand2,
  AlertCircle,
  LayoutTemplate,
  Palette,
  CheckCircle,
  HelpCircle,
  Clock,
  ChevronDown,
  ChevronUp,
} from '@lucide/vue';

const route = useRoute();
const router = useRouter();
const userStore = useUserStore();
const projectId = computed(() => route.params.id as string);

const { data: project } = useProjectQuery(projectId.value);
const { data: brief, isLoading: isLoadingBrief } = useBriefQuery(
  projectId.value,
);

const briefRevisionId = computed(() => brief.value?.id);
const isBriefConfirmed = computed(() => !!brief.value?.confirmedAt);

const {
  data: directionsData,
  isLoading: isLoadingDirections,
  isError,
  refetch,
} = useDirectionsQuery(projectId.value, briefRevisionId.value);

const createMutation = useCreateDirectionsMutation();

const showCreateDialog = ref(false);
const expandedConcepts = ref<Record<string, boolean>>({});

const canGenerate = computed(() => {
  const role = userStore.user?.role;
  return role === 'admin' || role === 'designer';
});

function toggleConcept(id: string) {
  expandedConcepts.value[id] = !expandedConcepts.value[id];
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleString('zh-CN');
}

function goBack() {
  router.push(`/projects/${projectId.value}`);
}

function openCreateDialog() {
  if (!isBriefConfirmed.value) {
    alert('请先确认 Brief 才能生成设计方向');
    return;
  }
  showCreateDialog.value = true;
}

async function startGenerate() {
  if (!brief.value) return;
  try {
    await createMutation.mutateAsync({
      projectId: projectId.value,
      body: {
        briefRevisionId: brief.value.id,
        count: 3,
      },
    });
    showCreateDialog.value = false;
    alert('设计方向生成任务已提交，请稍后在任务中心查看结果');
  } catch {
    alert('生成请求失败，请重试');
  }
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex items-center text-sm text-muted-foreground">
      <button
        class="hover:text-foreground transition-colors"
        @click="router.push('/projects')"
      >
        项目管理
      </button>
      <ChevronRight class="mx-2 h-4 w-4" />
      <button class="hover:text-foreground transition-colors" @click="goBack">
        {{ project?.name || '加载中...' }}
      </button>
      <ChevronRight class="mx-2 h-4 w-4" />
      <span class="text-foreground font-medium">设计方向</span>
    </div>

    <PageHeader title="设计方向">
      <template #actions>
        <Button
          v-if="canGenerate"
          class="bg-purple-600 hover:bg-purple-700 text-white"
          @click="openCreateDialog"
        >
          <Wand2 class="mr-2 h-4 w-4" />
          生成设计方向
        </Button>
      </template>
    </PageHeader>

    <div
      v-if="isLoadingDirections || isLoadingBrief"
      class="flex justify-center p-12"
    >
      <div
        class="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"
      />
    </div>

    <div
      v-else-if="isError"
      class="flex flex-col items-center justify-center p-12 rounded-xl border border-red-200 bg-red-50 text-red-600"
    >
      <AlertCircle class="h-8 w-8 mb-2" />
      <p>加载设计方向失败，请稍后重试</p>
      <Button variant="outline" class="mt-4" @click="refetch">重试</Button>
    </div>

    <div
      v-else-if="!directionsData?.data || directionsData.data.length === 0"
      class="flex flex-col items-center justify-center p-12 rounded-xl border border-dashed bg-muted/30"
    >
      <div
        class="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mb-4"
      >
        <Compass class="h-8 w-8 text-primary" />
      </div>
      <h3 class="text-lg font-medium mb-2">暂无设计方向</h3>
      <p class="text-muted-foreground mb-6 text-center max-w-md">
        当前还没有生成任何设计方向。点击「生成设计方向」开始基于确认的 Brief 让
        AI 提供灵感。
      </p>
      <Button v-if="canGenerate" @click="openCreateDialog">
        生成设计方向
      </Button>
    </div>

    <div v-else class="grid grid-cols-1 xl:grid-cols-3 gap-6">
      <div
        v-for="(direction, index) in directionsData.data"
        :key="direction.id"
        class="flex flex-col rounded-xl border bg-card text-card-foreground shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden group"
      >
        <!-- Card Header -->
        <div
          class="p-6 border-b bg-gradient-to-br from-muted/50 to-muted/10 relative overflow-hidden"
        >
          <div
            class="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity"
          >
            <span class="text-6xl font-black italic">{{ index + 1 }}</span>
          </div>
          <h3
            class="font-bold text-xl text-foreground mb-2 pr-12 relative z-10"
          >
            {{ direction.title }}
          </h3>
          <div
            class="flex items-center text-xs text-muted-foreground relative z-10"
          >
            <Clock class="mr-1 h-3 w-3" />
            {{ formatDate(direction.createdAt) }}
          </div>
        </div>

        <!-- Card Body -->
        <div class="p-6 flex-1 flex flex-col gap-6">
          <!-- Concept -->
          <div>
            <h4
              class="text-sm font-semibold flex items-center text-muted-foreground mb-2"
            >
              <Compass class="mr-2 h-4 w-4" /> 核心概念
            </h4>
            <div class="relative">
              <p
                class="text-sm leading-relaxed"
                :class="{ 'line-clamp-3': !expandedConcepts[direction.id] }"
              >
                {{ direction.concept }}
              </p>
              <button
                class="text-xs text-primary mt-1 hover:underline flex items-center"
                @click="toggleConcept(direction.id)"
              >
                {{ expandedConcepts[direction.id] ? '收起' : '展开阅读' }}
                <ChevronUp
                  v-if="expandedConcepts[direction.id]"
                  class="ml-1 h-3 w-3"
                />
                <ChevronDown v-else class="ml-1 h-3 w-3" />
              </button>
            </div>
          </div>

          <!-- Layout & Flow -->
          <div>
            <h4
              class="text-sm font-semibold flex items-center text-muted-foreground mb-2"
            >
              <LayoutTemplate class="mr-2 h-4 w-4" /> 空间布局
            </h4>
            <p
              class="text-sm leading-relaxed bg-muted/30 p-3 rounded-lg border border-muted"
            >
              {{ direction.layoutDescription }}
            </p>
          </div>

          <!-- Materials & Colors -->
          <div>
            <h4
              class="text-sm font-semibold flex items-center text-muted-foreground mb-2"
            >
              <Palette class="mr-2 h-4 w-4" /> 材质与色彩
            </h4>
            <p
              class="text-sm leading-relaxed border-l-2 border-primary/40 pl-3 py-1"
            >
              {{ direction.materialsAndColors }}
            </p>
          </div>

          <!-- Constraints Checklist -->
          <div v-if="direction.constraintsChecklist?.length">
            <h4
              class="text-sm font-semibold flex items-center text-muted-foreground mb-3"
            >
              <CheckCircle class="mr-2 h-4 w-4" /> 约束清单
            </h4>
            <div class="flex flex-wrap gap-2">
              <Badge
                v-for="(item, idx) in direction.constraintsChecklist"
                :key="idx"
                variant="secondary"
                class="bg-blue-50 text-blue-700 hover:bg-blue-100 border-blue-200"
              >
                {{ item }}
              </Badge>
            </div>
          </div>

          <!-- Questions For Confirmation -->
          <div
            v-if="direction.questionsForConfirmation?.length"
            class="mt-auto pt-4 border-t"
          >
            <h4
              class="text-sm font-semibold flex items-center text-amber-600 mb-2"
            >
              <HelpCircle class="mr-2 h-4 w-4" /> 待确认事项
            </h4>
            <ul class="space-y-2">
              <li
                v-for="(q, idx) in direction.questionsForConfirmation"
                :key="idx"
                class="text-sm flex items-start gap-2 bg-amber-50 p-2 rounded-md text-amber-900 border border-amber-100"
              >
                <span class="font-bold text-amber-500 mt-0.5"
                  >{{ idx + 1 }}.</span
                >
                <span>{{ q }}</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>

    <!-- Create Dialog -->
    <Dialog :open="showCreateDialog" @update:open="showCreateDialog = $event">
      <DialogContent class="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>生成设计方向</DialogTitle>
          <DialogDescription>
            基于当前已确认的 Brief，AI 将生成 3
            个差异化的设计方向，为您提供设计灵感与思路。
          </DialogDescription>
        </DialogHeader>

        <div v-if="!isBriefConfirmed" class="py-4">
          <div
            class="p-3 bg-red-50 text-red-600 rounded-md border border-red-200 flex items-start gap-2 text-sm"
          >
            <AlertCircle class="h-4 w-4 mt-0.5 shrink-0" />
            <p>
              错误：当前项目还没有已确认的 Brief。请先在 Brief
              页面确认后再生成设计方向。
            </p>
          </div>
        </div>

        <DialogFooter class="mt-4">
          <Button variant="outline" @click="showCreateDialog = false">
            取消
          </Button>
          <Button
            :disabled="createMutation.isPending.value || !isBriefConfirmed"
            class="bg-purple-600 hover:bg-purple-700 text-white"
            @click="startGenerate"
          >
            <Wand2
              v-if="!createMutation.isPending.value"
              class="mr-2 h-4 w-4"
            />
            {{ createMutation.isPending.value ? '生成中...' : '开始生成' }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
