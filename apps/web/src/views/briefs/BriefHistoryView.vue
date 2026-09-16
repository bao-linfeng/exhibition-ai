<script setup lang="ts">
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  useBriefQuery,
  useBriefRevisionsQuery,
} from '../../api/queries/briefs.js';
import { useProjectQuery } from '../../api/queries/projects.js';
import PageHeader from '../../components/PageHeader.vue';
import { Button } from '../../components/ui/button/index.js';
import { Badge } from '../../components/ui/badge/index.js';
import { ChevronRight, FileClock, CheckCircle, ArrowLeft } from '@lucide/vue';

const route = useRoute();
const router = useRouter();
const projectId = computed(() => route.params.id as string);

const { data: project, isLoading: isLoadingProject } = useProjectQuery(
  projectId.value,
);
const { data: currentBrief, isLoading: isLoadingBrief } = useBriefQuery(
  projectId.value,
);
const { data: revisionsData, isLoading: isLoadingRevisions } =
  useBriefRevisionsQuery(projectId.value);

const revisions = computed(() => revisionsData.value?.data || []);

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleString('zh-CN');
}

function goBack() {
  router.push(`/projects/${projectId.value}/brief`);
}
</script>

<template>
  <div
    v-if="isLoadingProject || isLoadingBrief || isLoadingRevisions"
    class="flex justify-center p-12"
  >
    <div
      class="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"
    />
  </div>

  <div v-else-if="project">
    <div class="mb-4 flex items-center text-sm text-muted-foreground">
      <button
        class="hover:text-foreground transition-colors"
        @click="router.push('/projects')"
      >
        项目管理
      </button>
      <ChevronRight class="mx-2 h-4 w-4" />
      <button
        class="hover:text-foreground transition-colors"
        @click="router.push(`/projects/${projectId}`)"
      >
        {{ project.name }}
      </button>
      <ChevronRight class="mx-2 h-4 w-4" />
      <button class="hover:text-foreground transition-colors" @click="goBack">
        Brief
      </button>
      <ChevronRight class="mx-2 h-4 w-4" />
      <span class="text-foreground font-medium">历史版本</span>
    </div>

    <PageHeader title="Brief 历史版本">
      <template #actions>
        <Button variant="outline" @click="goBack">
          <ArrowLeft class="mr-2 h-4 w-4" /> 返回 Brief
        </Button>
      </template>
    </PageHeader>

    <div
      v-if="revisions.length === 0"
      class="flex flex-col items-center justify-center p-12 rounded-xl border border-dashed bg-muted/30"
    >
      <div
        class="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mb-4"
      >
        <FileClock class="h-8 w-8 text-primary" />
      </div>
      <h3 class="text-lg font-medium mb-2">暂无历史版本</h3>
      <p class="text-muted-foreground mb-6 text-center">
        当前项目还没有产生任何 Brief 历史版本记录。
      </p>
    </div>

    <div v-else class="space-y-4 max-w-4xl">
      <div
        v-for="rev in revisions"
        :key="rev.id"
        class="rounded-xl border bg-card text-card-foreground shadow-sm overflow-hidden flex flex-col sm:flex-row relative"
      >
        <div
          class="absolute left-0 top-0 bottom-0 w-1.5"
          :class="currentBrief?.id === rev.id ? 'bg-primary' : 'bg-transparent'"
        />

        <div class="p-6 flex-1 flex flex-col justify-center">
          <div class="flex items-center gap-3 mb-2">
            <h3 class="text-lg font-semibold flex items-center gap-2">
              版本 v{{ rev.number }}
            </h3>
            <Badge
              v-if="currentBrief?.id === rev.id"
              class="bg-primary/10 text-primary hover:bg-primary/10"
            >
              当前版本
            </Badge>
            <Badge
              v-if="rev.confirmedAt"
              class="bg-green-100 text-green-700 hover:bg-green-100 border-green-200"
            >
              <CheckCircle class="w-3 h-3 mr-1" /> 已确认
            </Badge>
          </div>
          <div
            class="grid grid-cols-2 gap-x-4 gap-y-2 mt-2 text-sm text-muted-foreground"
          >
            <div>
              <span class="font-medium mr-1">创建时间:</span>
              {{ formatDate(rev.createdAt) }}
            </div>
            <div v-if="rev.confirmedAt">
              <span class="font-medium mr-1">确认时间:</span>
              {{ formatDate(rev.confirmedAt) }}
            </div>
            <div class="col-span-2 mt-1 flex gap-4">
              <span
                >展台: {{ rev.content.booth.widthM }}×{{
                  rev.content.booth.depthM
                }}m</span
              >
              <span
                >预算:
                {{
                  rev.content.budget
                    ? rev.content.budget.amountMinor / 100 + '元'
                    : '未设置'
                }}</span
              >
              <span>功能区: {{ rev.content.functionalAreas.length }}个</span>
            </div>
          </div>
        </div>

        <div
          class="p-6 bg-muted/10 border-t sm:border-t-0 sm:border-l flex items-center justify-center sm:w-48"
        >
          <Button variant="outline" class="w-full" disabled>查看详情</Button>
        </div>
      </div>
    </div>
  </div>
</template>
