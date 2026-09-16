<script setup lang="ts">
import { ref } from 'vue';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { ImageVersion } from '@exhibition/contracts';

interface Props {
  versionA: ImageVersion;
  versionB: ImageVersion;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  close: [];
  select: [version: ImageVersion];
}>();

const sliderPosition = ref(50);

function getImageUrl(assetId: string) {
  return `/api/v1/assets/${assetId}/download`;
}

function handleSliderMove(event: MouseEvent) {
  const container = (
    event.currentTarget as HTMLElement
  ).getBoundingClientRect();
  const position = ((event.clientX - container.left) / container.width) * 100;
  sliderPosition.value = Math.max(0, Math.min(100, position));
}
</script>

<template>
  <Card class="border-slate-800 bg-slate-900">
    <div class="space-y-4 p-6">
      <div class="flex items-center justify-between">
        <h3 class="text-lg font-semibold text-slate-100">版本比较</h3>
        <Button variant="ghost" size="sm" @click="emit('close')"> 关闭 </Button>
      </div>

      <!-- 版本信息 -->
      <div class="grid grid-cols-2 gap-4 text-sm">
        <div class="space-y-1">
          <Badge variant="outline" class="border-slate-700 bg-slate-800">
            V{{ props.versionA.sequence }}
          </Badge>
          <p class="text-slate-400">
            {{ props.versionA.width }} × {{ props.versionA.height }}
          </p>
          <p class="text-xs text-slate-500">
            {{ new Date(props.versionA.createdAt).toLocaleString('zh-CN') }}
          </p>
        </div>
        <div class="space-y-1">
          <Badge variant="outline" class="border-slate-700 bg-slate-800">
            V{{ props.versionB.sequence }}
          </Badge>
          <p class="text-slate-400">
            {{ props.versionB.width }} × {{ props.versionB.height }}
          </p>
          <p class="text-xs text-slate-500">
            {{ new Date(props.versionB.createdAt).toLocaleString('zh-CN') }}
          </p>
        </div>
      </div>

      <!-- 滑动比较器 -->
      <div
        class="relative aspect-[16/9] cursor-ew-resize overflow-hidden rounded-lg bg-slate-950"
        @mousemove="handleSliderMove"
      >
        <!-- 图片 B (底层) -->
        <img
          :src="getImageUrl(props.versionB.assetId)"
          alt="Version B"
          class="absolute inset-0 h-full w-full object-contain"
        />

        <!-- 图片 A (顶层，使用 clip-path) -->
        <div
          class="absolute inset-0"
          :style="{
            clipPath: `inset(0 ${100 - sliderPosition}% 0 0)`,
          }"
        >
          <img
            :src="getImageUrl(props.versionA.assetId)"
            alt="Version A"
            class="h-full w-full object-contain"
          />
        </div>

        <!-- 滑块 -->
        <div
          class="absolute inset-y-0 w-1 bg-cyan-500"
          :style="{ left: `${sliderPosition}%` }"
        >
          <div
            class="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-cyan-500 p-2 shadow-lg"
          >
            <svg
              class="h-4 w-4 text-slate-950"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M8 9l4-4 4 4m0 6l-4 4-4-4"
              />
            </svg>
          </div>
        </div>
      </div>

      <!-- 操作按钮 -->
      <div class="flex justify-end gap-2">
        <Button
          variant="outline"
          size="sm"
          class="border-slate-700 bg-slate-900 hover:bg-slate-800"
          @click="emit('select', props.versionA)"
        >
          选择 V{{ props.versionA.sequence }}
        </Button>
        <Button
          variant="outline"
          size="sm"
          class="border-slate-700 bg-slate-900 hover:bg-slate-800"
          @click="emit('select', props.versionB)"
        >
          选择 V{{ props.versionB.sequence }}
        </Button>
      </div>
    </div>
  </Card>
</template>
