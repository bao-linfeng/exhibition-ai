<script setup lang="ts">
import { TableRow, TableCell } from './ui/table/index.js';

defineProps<{
  columns: number;
  rows?: number;
}>();
</script>

<template>
  <TableRow v-for="i in (rows || 3)" :key="i">
    <TableCell v-for="j in columns" :key="j">
      <div class="h-4 w-full max-w-[80%] rounded bg-muted animate-pulse"></div>
    </TableCell>
  </TableRow>
</template>
