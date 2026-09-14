<script setup lang="ts">
defineProps<{
  title: string;
  description?: string;
}>();
</script>

<template>
  <div
    class="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
  >
    <div>
      <h1 class="text-2xl font-bold tracking-tight text-foreground">
        {{ title }}
      </h1>
      <p v-if="description" class="text-sm text-muted-foreground mt-1">
        {{ description }}
      </p>
    </div>
    <div class="flex items-center gap-2">
      <slot name="actions" />
    </div>
  </div>
</template>
