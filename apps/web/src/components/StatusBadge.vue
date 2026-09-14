<script setup lang="ts">
import { computed } from 'vue';
import { Badge } from './ui/badge/index.js';

const props = defineProps<{
  status: string;
}>();

const variant = computed(() => {
  const map: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
    // Customers
    active: 'default',
    inactive: 'secondary',
    // Projects
    draft: 'secondary',
    briefing: 'default',
    designing: 'default',
    reviewing: 'default',
    approved: 'default', // Ideally success, we can use custom classes
    archived: 'outline',
  };
  return map[props.status] || 'default';
});

const customClass = computed(() => {
  const map: Record<string, string> = {
    active: 'bg-green-500/15 text-green-700 hover:bg-green-500/25 border-green-500/20',
    inactive: 'bg-gray-500/15 text-gray-700 hover:bg-gray-500/25 border-gray-500/20',
    draft: 'bg-gray-500/15 text-gray-700 hover:bg-gray-500/25 border-gray-500/20',
    briefing: 'bg-blue-500/15 text-blue-700 hover:bg-blue-500/25 border-blue-500/20',
    designing: 'bg-purple-500/15 text-purple-700 hover:bg-purple-500/25 border-purple-500/20',
    reviewing: 'bg-orange-500/15 text-orange-700 hover:bg-orange-500/25 border-orange-500/20',
    approved: 'bg-green-500/15 text-green-700 hover:bg-green-500/25 border-green-500/20',
    archived: 'bg-slate-500/15 text-slate-700 hover:bg-slate-500/25 border-slate-500/20',
  };
  return map[props.status] || '';
});

const label = computed(() => {
  const map: Record<string, string> = {
    active: '活跃',
    inactive: '非活跃',
    draft: '草稿',
    briefing: '需求确认',
    designing: '设计中',
    reviewing: '审核中',
    approved: '已通过',
    archived: '已归档',
  };
  return map[props.status] || props.status;
});
</script>

<template>
  <Badge :variant="variant" :class="['border font-medium', customClass]">
    {{ label }}
  </Badge>
</template>
