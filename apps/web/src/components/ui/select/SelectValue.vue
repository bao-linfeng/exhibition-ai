<script setup lang="ts">
import { cn } from '@/lib/utils';

interface Props {
  placeholder?: string;
  class?: string;
}

const props = defineProps<Props>();
</script>

<template>
  <span :class="cn('block truncate', props.class)">
    <slot>{{ placeholder }}</slot>
  </span>
</template>
