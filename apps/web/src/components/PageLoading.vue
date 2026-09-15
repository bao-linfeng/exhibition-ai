<script setup lang="ts">
import { Loader2 } from '@lucide/vue';
</script>
<template>
  <div
    class="flex h-full min-h-[200px] items-center justify-center text-muted-foreground"
    role="status"
    aria-label="加载中"
  >
    <Loader2 class="h-6 w-6 animate-spin mr-2" aria-hidden="true" />
    <span>加载中...</span>
  </div>
</template>
