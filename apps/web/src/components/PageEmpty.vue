<script setup lang="ts">
import { Inbox } from '@lucide/vue';
defineProps<{ message?: string }>();
</script>
<template>
  <div
    class="flex h-full min-h-[200px] flex-col items-center justify-center gap-2 text-muted-foreground"
  >
    <Inbox class="h-10 w-10 opacity-40" aria-hidden="true" />
    <p class="text-sm">{{ message || '暂无数据' }}</p>
  </div>
</template>
