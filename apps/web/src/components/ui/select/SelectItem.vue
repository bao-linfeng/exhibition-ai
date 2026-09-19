<script setup lang="ts">
import { inject, computed } from 'vue';
import { cn } from '@/lib/utils';

interface Props {
  value: string | number;
  class?: string;
}

const props = defineProps<Props>();

const ctx = inject<{
  modelValue: () => string | number | undefined;
  handleSelect: (value: string | number) => void;
}>('select-context')!;

const isSelected = computed(() => ctx.modelValue() === props.value);
</script>

<template>
  <div
    role="option"
    :aria-selected="isSelected"
    @click="ctx.handleSelect(props.value)"
    :class="
      cn(
        'relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm text-slate-100 outline-none hover:bg-slate-800 focus:bg-slate-800',
        isSelected && 'bg-slate-700 font-medium',
        props.class,
      )
    "
  >
    <slot />
    <svg
      v-if="isSelected"
      class="ml-auto h-4 w-4 shrink-0"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
    </svg>
  </div>
</template>
