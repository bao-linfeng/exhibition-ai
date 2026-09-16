<script setup lang="ts">
import { cn } from '@/lib/utils';

interface Props {
  value: string | number;
  class?: string;
}

const props = defineProps<Props>();
</script>

<template>
  <div
    :class="
      cn(
        'relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm text-slate-100 outline-none hover:bg-slate-800 focus:bg-slate-800',
        props.class,
      )
    "
  >
    <slot />
  </div>
</template>
