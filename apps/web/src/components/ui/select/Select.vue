<script setup lang="ts">
import { ref, provide, readonly } from 'vue';

interface Props {
  modelValue?: string | number;
  disabled?: boolean;
  placeholder?: string;
  class?: string;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  'update:modelValue': [value: string | number];
}>();

const isOpen = ref(false);

function toggle() {
  if (!props.disabled) {
    isOpen.value = !isOpen.value;
  }
}

function handleSelect(value: string | number) {
  emit('update:modelValue', value);
  isOpen.value = false;
}

function close() {
  isOpen.value = false;
}

// 提供上下文给所有子组件
provide('select-context', {
  isOpen: readonly(isOpen),
  modelValue: () => props.modelValue,
  disabled: () => props.disabled,
  placeholder: () => props.placeholder,
  toggle,
  handleSelect,
  close,
});
</script>

<template>
  <div class="relative" @keydown.escape="close">
    <slot />
  </div>
</template>
