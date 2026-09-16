<script setup lang="ts">
import { computed, inject } from 'vue';

const currentValue = inject<{ value: string | undefined }>('tabs-value', {
  value: undefined,
});

const props = defineProps<{
  value: string;
}>();

const isActive = computed(() => currentValue.value === props.value);
</script>

<template>
  <div v-show="isActive" class="mt-2">
    <slot />
  </div>
</template>
