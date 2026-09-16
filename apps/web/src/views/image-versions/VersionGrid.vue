<script setup lang="ts">
import { computed } from 'vue';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { ImageVersion } from '@exhibition/contracts';

interface Props {
  versions: ImageVersion[];
  selectedVersionId: string | null;
  loading?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
});

const emit = defineEmits<{
  select: [version: ImageVersion];
  compare: [versionA: ImageVersion, versionB: ImageVersion];
  viewDetails: [version: ImageVersion];
  createVariation: [version: ImageVersion];
}>();

function getImageUrl(assetId: string) {
  // TODO: 实现获取图片 URL 的逻辑（需要签名 URL）
  return `/api/v1/assets/${assetId}/download`;
}

const isSelected = computed(() => (versionId: string) => {
  return props.selectedVersionId === versionId;
});
</script>

<template>
  <div class="space-y-4">
    <div
      v-if="props.loading"
      class="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4"
    >
      <div
        v-for="i in 8"
        :key="i"
        class="aspect-[4/3] animate-pulse rounded-lg bg-slate-800"
      />
    </div>

    <div
      v-else-if="props.versions.length === 0"
      class="flex min-h-[400px] items-center justify-center rounded-lg border border-dashed border-slate-700 bg-slate-900/50"
    >
      <div class="text-center">
        <p class="text-sm text-slate-400">暂无图片版本</p>
        <p class="mt-1 text-xs text-slate-500">开始生成或修改图片</p>
      </div>
    </div>

    <div v-else class="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
      <div
        v-for="version in props.versions"
        :key="version.id"
        :class="{
          'ring-2 ring-cyan-500': isSelected(version.id),
        }"
      >
        <Card
          class="group relative overflow-hidden border-slate-800 bg-slate-900 transition-all hover:border-cyan-500/50"
        >
          <div class="aspect-[4/3] overflow-hidden bg-slate-950">
            <img
              :src="getImageUrl(version.assetId)"
              :alt="`Version ${version.sequence}`"
              class="h-full w-full object-cover transition-transform group-hover:scale-105"
              loading="lazy"
            />
          </div>

          <div
            class="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950 via-slate-950/80 to-transparent p-3"
          >
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <Badge
                  variant="outline"
                  class="border-slate-700 bg-slate-900/90 text-xs"
                >
                  V{{ version.sequence }}
                </Badge>
                <Badge
                  v-if="isSelected(version.id)"
                  class="bg-cyan-500/20 text-cyan-400 border-cyan-500/30 text-xs"
                >
                  已选中
                </Badge>
              </div>
            </div>

            <div class="mt-2 text-xs text-slate-400">
              {{ version.width }} × {{ version.height }}
            </div>
          </div>

          <!-- 悬浮操作按钮 -->
          <div
            class="absolute inset-0 flex items-center justify-center gap-2 bg-slate-950/80 opacity-0 transition-opacity group-hover:opacity-100"
          >
            <Button
              v-if="!isSelected(version.id)"
              size="sm"
              class="bg-cyan-600 hover:bg-cyan-700"
              @click="emit('select', version)"
            >
              选中
            </Button>
            <Button
              size="sm"
              variant="outline"
              class="border-slate-700 bg-slate-900 hover:bg-slate-800"
              @click="emit('viewDetails', version)"
            >
              查看
            </Button>
            <Button
              size="sm"
              variant="outline"
              class="border-slate-700 bg-slate-900 hover:bg-slate-800"
              @click="emit('createVariation', version)"
            >
              修改
            </Button>
          </div>
        </Card>
      </div>
    </div>
  </div>
</template>
