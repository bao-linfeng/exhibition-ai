<script setup lang="ts">
import { useRouter } from 'vue-router';
import { Button } from '../components/ui/button/index.js';
import { FileQuestion } from '@lucide/vue';
const router = useRouter();
</script>
<template>
  <div
    class="flex min-h-screen flex-col items-center justify-center gap-4 text-center p-8"
  >
    <FileQuestion
      class="h-16 w-16 text-muted-foreground opacity-50"
      aria-hidden="true"
    />
    <div>
      <h1 class="text-3xl font-bold tracking-tight">页面未找到</h1>
      <p class="mt-2 text-muted-foreground">您访问的页面不存在或已被移除。</p>
    </div>
    <Button @click="router.push('/dashboard')">返回首页</Button>
  </div>
</template>
