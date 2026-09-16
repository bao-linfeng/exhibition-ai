<script setup lang="ts">
interface Props {
  error: Error | unknown;
}

const props = defineProps<Props>();

const errorMessage =
  props.error instanceof Error ? props.error.message : '未知错误';
</script>

<template>
  <div class="flex h-full items-center justify-center bg-slate-950">
    <div class="text-center">
      <div class="mb-4 text-6xl text-slate-600">⚠️</div>
      <h2 class="mb-2 text-xl font-semibold text-slate-100">加载失败</h2>
      <p class="text-sm text-slate-400">{{ errorMessage }}</p>
    </div>
  </div>
</template>
