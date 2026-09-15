<script setup lang="ts">
import { AlertCircle } from '@lucide/vue';
defineProps<{ message?: string }>();
defineEmits<{ retry: [] }>();
</script>
<template>
  <div class="flex h-full min-h-[200px] flex-col items-center justify-center gap-3 text-destructive" role="alert">
    <AlertCircle class="h-8 w-8" aria-hidden="true" />
    <p class="text-sm font-medium">{{ message || '加载失败，请重试' }}</p>
    <button 
      class="text-sm underline text-muted-foreground hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring rounded"
      @click="$emit('retry')"
    >重试</button>
  </div>
</template>