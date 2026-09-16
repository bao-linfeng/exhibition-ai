<script setup lang="ts">
import { ref, watchEffect } from 'vue';
import { useCreateDownloadUrlMutation } from '../../api/queries/assets.js';
import { Image as ImageIcon, AlertCircle } from '@lucide/vue';

const props = defineProps<{
  projectId: string;
  assetId: string;
  status: string;
}>();

const emit = defineEmits<{
  (e: 'click'): void;
}>();

const thumbnailUrl = ref<string | null>(null);
const isLoading = ref(true);
const hasError = ref(false);

const downloadUrlMutation = useCreateDownloadUrlMutation();

watchEffect(async () => {
  if (props.status === 'ready') {
    try {
      isLoading.value = true;
      hasError.value = false;
      const data = await downloadUrlMutation.mutateAsync({
        projectId: props.projectId,
        assetId: props.assetId,
        body: { variant: 'thumbnail' },
      });
      thumbnailUrl.value = data.url;
    } catch (e) {
      console.error('Failed to load thumbnail url:', e);
      hasError.value = true;
    } finally {
      isLoading.value = false;
    }
  } else {
    isLoading.value = false;
    thumbnailUrl.value = null;
    hasError.value = false;
  }
});

// Revoke object URLs if needed, but here we just have a presigned URL, so it's fine.
</script>

<template>
  <div
    class="relative w-full aspect-video bg-muted flex items-center justify-center overflow-hidden rounded-md cursor-pointer group"
    @click="emit('click')"
  >
    <template v-if="status === 'pending' || status === 'validating'">
      <div class="flex flex-col items-center text-muted-foreground">
        <div
          class="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent mb-2"
        />
        <span class="text-xs">处理中...</span>
      </div>
    </template>
    <template v-else-if="status === 'rejected' || hasError">
      <div class="flex flex-col items-center text-destructive">
        <AlertCircle class="h-8 w-8 mb-2 opacity-50" />
        <span class="text-xs">加载失败</span>
      </div>
    </template>
    <template v-else-if="thumbnailUrl">
      <img
        :src="thumbnailUrl"
        alt="Thumbnail"
        loading="lazy"
        class="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
        @error="hasError = true"
      />
      <div
        class="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors"
      />
    </template>
    <template v-else>
      <ImageIcon class="h-8 w-8 text-muted-foreground opacity-20" />
    </template>
  </div>
</template>
