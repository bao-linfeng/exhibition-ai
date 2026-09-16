<script setup lang="ts">
import { ref } from 'vue';
import { useAssetsQuery } from '@/api/queries/assets.js';
import AssetThumbnail from '../projects/AssetThumbnail.vue';
import { Button } from '@/components/ui/button';
import { Upload, Filter } from '@lucide/vue';
import { useRouter } from 'vue-router';
import PageLoading from '@/components/PageLoading.vue';

const props = defineProps<{ projectId: string }>();
const router = useRouter();

const activeFilter = ref<string>('');

const { data: assetsData, isLoading } = useAssetsQuery(props.projectId, () => ({
  kind: activeFilter.value || undefined,
}));

const filters = [
  { label: '全部', value: '' },
  { label: 'Logo', value: 'logo' },
  { label: '产品', value: 'product' },
  { label: '参考', value: 'reference' },
  { label: '资料', value: 'brand_material' },
];

function handleUpload() {
  router.push(`/projects/${props.projectId}/assets`);
}
</script>

<template>
  <div class="h-full flex flex-col p-4">
    <div class="flex items-center justify-between mb-4">
      <h3 class="font-semibold text-slate-100">项目素材</h3>
      <Button
        variant="ghost"
        size="sm"
        class="h-8 text-cyan-500 hover:text-cyan-400 hover:bg-cyan-500/10"
        @click="handleUpload"
      >
        <Upload class="w-4 h-4 mr-2" />
        上传
      </Button>
    </div>

    <!-- Filters -->
    <div class="flex flex-wrap gap-2 mb-4">
      <Button
        v-for="f in filters"
        :key="f.value"
        variant="outline"
        size="sm"
        class="h-7 text-xs rounded-full border-slate-700"
        :class="
          activeFilter === f.value
            ? 'bg-slate-700 text-slate-100'
            : 'bg-transparent text-slate-400 hover:text-slate-300 hover:bg-slate-800'
        "
        @click="activeFilter = f.value"
      >
        {{ f.label }}
      </Button>
    </div>

    <div v-if="isLoading" class="flex-1 flex justify-center items-center">
      <PageLoading />
    </div>
    <div
      v-else-if="assetsData?.data && assetsData.data.length > 0"
      class="flex-1 overflow-y-auto"
    >
      <div class="grid grid-cols-2 gap-3 pb-4">
        <AssetThumbnail
          v-for="asset in assetsData.data"
          :key="asset.id"
          :project-id="projectId"
          :asset-id="asset.id"
          :status="asset.status"
          @click="router.push(`/projects/${projectId}/assets`)"
        />
      </div>
    </div>
    <div
      v-else
      class="flex-1 flex flex-col justify-center items-center text-sm text-slate-400"
    >
      <Filter class="w-8 h-8 mb-2 opacity-50" />
      <span>未找到素材</span>
    </div>
  </div>
</template>
