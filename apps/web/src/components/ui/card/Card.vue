<script setup lang="ts">
import { cn } from '@/lib/utils';

interface Props {
  class?: string;
}

const props = defineProps<Props>();
</script>

<template>
  <div
    :class="
      cn(
        'rounded-lg border border-slate-200 bg-white text-slate-950 shadow-sm',
        props.class,
      )
    "
  >
    <slot />
  </div>
</template>
