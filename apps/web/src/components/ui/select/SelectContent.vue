<script setup lang="ts">
import { inject } from 'vue';
import { cn } from '@/lib/utils';

interface Props {
  class?: string;
}

const props = defineProps<Props>();

const ctx = inject<{
  isOpen: { value: boolean };
  close: () => void;
}>('select-context')!;
</script>

<template>
  <template v-if="ctx.isOpen.value">
    <!-- backdrop: 点击外部关闭 -->
    <div class="fixed inset-0 z-40" @click="ctx.close()" />
    <div
      role="listbox"
      :class="
        cn(
          'absolute z-50 mt-1 w-full rounded-md border border-slate-700 bg-slate-900 shadow-lg p-1',
          props.class,
        )
      "
    >
      <slot />
    </div>
  </template>
</template>
