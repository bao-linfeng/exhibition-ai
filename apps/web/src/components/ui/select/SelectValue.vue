<script setup lang="ts">
import { inject, computed } from 'vue';
import { cn } from '@/lib/utils';

interface Props {
  placeholder?: string;
  class?: string;
}

const props = defineProps<Props>();

const ctx = inject<{
  modelValue: () => string | number | undefined;
  placeholder: () => string | undefined;
}>('select-context')!;

const displayValue = computed(() => ctx.modelValue());
const effectivePlaceholder = computed(
  () => props.placeholder ?? ctx.placeholder?.() ?? '',
);
</script>

<template>
  <span :class="cn('block truncate', props.class)">
    <slot v-if="$slots.default" />
    <template v-else-if="displayValue !== undefined && displayValue !== ''">{{
      displayValue
    }}</template>
    <span v-else class="text-slate-500">{{ effectivePlaceholder }}</span>
  </span>
</template>
