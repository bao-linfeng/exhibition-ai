<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  modelValue?: string;
  defaultValue?: string;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: string];
}>();

const currentValue = computed({
  get: () => props.modelValue ?? props.defaultValue,
  set: (value) => emit('update:modelValue', value ?? ''),
});
</script>

<template>
  <div class="space-y-2">
    <slot :current-value="currentValue" />
  </div>
</template>
