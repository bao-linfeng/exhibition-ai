<script setup lang="ts">
import { ShieldOff } from '@lucide/vue';
defineProps<{ message?: string }>();
</script>
<template>
  <div
    class="flex h-full min-h-[200px] flex-col items-center justify-center gap-2 text-muted-foreground"
    role="alert"
    aria-live="assertive"
  >
    <ShieldOff class="h-10 w-10 opacity-40" aria-hidden="true" />
    <p class="text-sm font-medium">{{ message || '无访问权限' }}</p>
  </div>
</template>
