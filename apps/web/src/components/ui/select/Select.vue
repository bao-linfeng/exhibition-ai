<script setup lang="ts">
import { ref } from 'vue';

interface Props {
  modelValue?: string | number;
  disabled?: boolean;
  placeholder?: string;
  class?: string;
}

defineProps<Props>();

const emit = defineEmits<{
  'update:modelValue': [value: string | number];
}>();

const isOpen = ref(false);

function handleSelect(value: string | number) {
  emit('update:modelValue', value);
  isOpen.value = false;
}
</script>

<template>
  <div class="relative">
    <slot name="trigger" :is-open="isOpen" :toggle="() => (isOpen = !isOpen)" />
    <div
      v-if="isOpen"
      class="absolute z-50 mt-1 w-full rounded-md border border-slate-700 bg-slate-900 shadow-lg"
    >
      <slot
        name="content"
        :select="handleSelect"
        :close="() => (isOpen = false)"
      />
    </div>
  </div>
</template>
