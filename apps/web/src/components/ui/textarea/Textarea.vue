<script setup lang="ts">
import { cn } from '@/lib/utils';

interface Props {
  class?: string;
  disabled?: boolean;
  rows?: number;
  maxlength?: number;
  placeholder?: string;
  modelValue?: string;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  'update:modelValue': [value: string];
}>();
</script>

<template>
  <textarea
    :value="modelValue"
    :disabled="disabled"
    :rows="rows"
    :maxlength="maxlength"
    :placeholder="placeholder"
    :class="
      cn(
        'flex min-h-[80px] w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 disabled:cursor-not-allowed disabled:opacity-50',
        props.class,
      )
    "
    @input="
      emit('update:modelValue', ($event.target as HTMLTextAreaElement).value)
    "
  />
</template>
