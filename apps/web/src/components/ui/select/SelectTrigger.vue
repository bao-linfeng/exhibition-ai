<script setup lang="ts">
import { inject } from 'vue';
import { cn } from '@/lib/utils';

interface Props {
  id?: string;
  class?: string;
}

const props = defineProps<Props>();

const ctx = inject<{
  isOpen: { value: boolean };
  disabled: () => boolean | undefined;
  toggle: () => void;
}>('select-context')!;
</script>

<template>
  <button
    :id="id"
    type="button"
    role="combobox"
    :aria-expanded="ctx.isOpen.value"
    :disabled="ctx.disabled()"
    @click="ctx.toggle()"
    :class="
      cn(
        'flex h-10 w-full items-center justify-between rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 disabled:cursor-not-allowed disabled:opacity-50',
        props.class,
      )
    "
  >
    <slot />
    <svg
      class="h-4 w-4 opacity-50 shrink-0 transition-transform"
      :class="{ 'rotate-180': ctx.isOpen.value }"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        stroke-width="2"
        d="M19 9l-7 7-7-7"
      />
    </svg>
  </button>
</template>
