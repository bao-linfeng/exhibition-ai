<script setup lang="ts">
import { computed } from 'vue';
import { useBriefQuery } from '@/api/queries/briefs.js';
import { Button } from '@/components/ui/button';
import { FileText, CheckCircle, AlertCircle } from '@lucide/vue';
import { useRouter } from 'vue-router';
import PageLoading from '@/components/PageLoading.vue';
import { Badge } from '@/components/ui/badge';

const props = defineProps<{ projectId: string }>();
const router = useRouter();

const { data: brief, isLoading } = useBriefQuery(() => props.projectId);

const isConfirmed = computed(() => !!brief.value?.confirmedAt);

const briefContent = computed(() => brief.value?.content);
</script>

<template>
  <div class="h-full flex flex-col p-4">
    <div v-if="isLoading" class="flex-1 flex justify-center items-center">
      <PageLoading />
    </div>
    <div v-else-if="briefContent" class="flex-1 flex flex-col gap-6">
      <div class="flex items-center justify-between">
        <h3 class="font-semibold text-slate-100">Brief 概览</h3>
        <Badge
          :variant="isConfirmed ? 'default' : 'secondary'"
          class="flex items-center gap-1"
        >
          <CheckCircle v-if="isConfirmed" class="w-3 h-3" />
          <AlertCircle v-else class="w-3 h-3" />
          {{ isConfirmed ? '已确认' : '未确认' }}
        </Badge>
      </div>

      <div class="space-y-4 text-sm text-slate-300 flex-1 overflow-y-auto">
        <div v-if="briefContent.booth">
          <div class="text-xs text-slate-500 mb-1">展台尺寸</div>
          <div class="font-medium text-slate-200">
            {{ briefContent.booth.widthM }} × {{ briefContent.booth.depthM }} m
            <span v-if="briefContent.booth.heightLimitM" class="text-slate-400">
              (限高 {{ briefContent.booth.heightLimitM }}m)
            </span>
          </div>
        </div>

        <div v-if="briefContent.brand">
          <div class="text-xs text-slate-500 mb-1">品牌信息</div>
          <div class="font-medium text-slate-200">
            {{ briefContent.brand.name }}
          </div>
          <div
            v-if="
              briefContent.brand.primaryColor ||
              briefContent.brand.secondaryColor
            "
            class="flex gap-2 mt-2"
          >
            <div
              v-if="briefContent.brand.primaryColor"
              class="w-6 h-6 rounded-md shadow-sm border border-slate-700"
              :style="{ backgroundColor: briefContent.brand.primaryColor }"
              :title="'主色: ' + briefContent.brand.primaryColor"
            ></div>
            <div
              v-if="briefContent.brand.secondaryColor"
              class="w-6 h-6 rounded-md shadow-sm border border-slate-700"
              :style="{ backgroundColor: briefContent.brand.secondaryColor }"
              :title="'辅色: ' + briefContent.brand.secondaryColor"
            ></div>
          </div>
        </div>

        <div v-if="briefContent.budget">
          <div class="text-xs text-slate-500 mb-1">预算</div>
          <div class="font-medium text-slate-200">
            {{ briefContent.budget.currency }}
            {{ (briefContent.budget.amountMinor / 100).toLocaleString() }}
          </div>
        </div>

        <div v-if="briefContent.deadline">
          <div class="text-xs text-slate-500 mb-1">截止日期</div>
          <div class="font-medium text-slate-200">
            {{ new Date(briefContent.deadline).toLocaleDateString() }}
          </div>
        </div>
      </div>

      <Button
        variant="outline"
        class="w-full mt-4 border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-300"
        @click="router.push(`/projects/${projectId}/brief`)"
      >
        <FileText class="w-4 h-4 mr-2" />
        查看完整 Brief
      </Button>
    </div>
    <div
      v-else
      class="flex-1 flex flex-col justify-center items-center text-sm text-slate-400"
    >
      <AlertCircle class="w-8 h-8 mb-2 opacity-50" />
      <span>暂无 Brief 信息</span>
    </div>
  </div>
</template>
