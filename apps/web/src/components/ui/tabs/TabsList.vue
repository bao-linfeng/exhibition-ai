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
        'inline-flex h-10 items-center justify-center rounded-md bg-slate-900 p-1 text-slate-400',
        props.class,
      )
    "
  >
    <slot />
  </div>
</template>
