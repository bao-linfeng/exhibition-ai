<script setup lang="ts">
import { cn } from '@/lib/utils';

interface Props {
  variant?: 'default' | 'warning' | 'destructive';
  class?: string;
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'default',
});

const variantStyles = {
  default: 'border-slate-700 bg-slate-900 text-slate-100',
  warning: 'border-amber-700 bg-amber-950/50 text-amber-100',
  destructive: 'border-red-700 bg-red-950/50 text-red-100',
};
</script>

<template>
  <div
    :class="cn('rounded-lg border p-4', variantStyles[variant], props.class)"
  >
    <slot />
  </div>
</template>
