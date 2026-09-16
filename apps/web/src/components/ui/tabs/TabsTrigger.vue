<script setup lang="ts">
import { computed, inject } from 'vue';
import { cn } from '@/lib/utils';

const currentValue = inject<{ value: string | undefined }>('tabs-value', {
  value: undefined,
});

interface Props {
  value: string;
  class?: string;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  click: [];
}>();

const isActive = computed(() => currentValue.value === props.value);
</script>

<template>
  <button
    type="button"
    :class="
      cn(
        'inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
        isActive
          ? 'bg-slate-800 text-slate-100 shadow-sm'
          : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200',
        props.class,
      )
    "
    @click="emit('click')"
  >
    <slot />
  </button>
</template>
