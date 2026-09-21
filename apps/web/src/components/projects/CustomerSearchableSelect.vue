<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useInfiniteCustomersQuery } from '../../api/queries/customers.js';
import { Label } from '../ui/label/index.js';
import { Input } from '../ui/input/index.js';
import { Button } from '../ui/button/index.js';

interface Props {
  modelValue?: string;
  required?: boolean;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  'update:modelValue': [value: string];
}>();

const isOpen = ref(false);
const searchQuery = ref('');
const selectedCustomerName = ref('');

const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } =
  useInfiniteCustomersQuery(
    computed(() => ({
      status: 'active',
      search: searchQuery.value || undefined,
    })),
  );

const allCustomers = computed(() => {
  if (!data.value) return [];
  return data.value.pages.flatMap((page) => page.data);
});

watch(
  () => props.modelValue,
  (newId) => {
    if (newId) {
      const customer = allCustomers.value.find((c) => c.id === newId);
      if (customer) {
        selectedCustomerName.value = customer.name;
      }
    } else {
      selectedCustomerName.value = '';
    }
  },
  { immediate: true },
);

function selectCustomer(id: string, name: string) {
  emit('update:modelValue', id);
  selectedCustomerName.value = name;
  isOpen.value = false;
  searchQuery.value = '';
}

function clearSelection() {
  emit('update:modelValue', '');
  selectedCustomerName.value = '';
}

function handleLoadMore() {
  if (hasNextPage.value && !isFetchingNextPage.value) {
    fetchNextPage();
  }
}
</script>

<template>
  <div class="space-y-2">
    <Label for="customerId"
      >关联客户 <span class="text-destructive">*</span></Label
    >
    <div class="relative">
      <button
        type="button"
        :class="[
          'flex h-10 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
          !selectedCustomerName && 'text-muted-foreground',
        ]"
        @click="isOpen = !isOpen"
      >
        <span>{{ selectedCustomerName || '请选择客户' }}</span>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="transition-transform"
          :class="{ 'rotate-180': isOpen }"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      <div
        v-if="isOpen"
        class="absolute z-50 mt-1 w-full rounded-md border border-slate-700 bg-slate-900 shadow-lg"
      >
        <div class="p-2 border-b border-slate-700">
          <Input
            v-model="searchQuery"
            placeholder="搜索客户..."
            class="h-8"
            @keydown.escape="isOpen = false"
          />
        </div>

        <div class="max-h-64 overflow-y-auto">
          <div v-if="isLoading" class="p-4 text-center text-sm text-muted-foreground">
            加载中...
          </div>

          <div
            v-else-if="allCustomers.length === 0"
            class="p-4 text-center text-sm text-muted-foreground"
          >
            {{ searchQuery ? '未找到匹配的客户' : '暂无活跃客户' }}
          </div>

          <div v-else>
            <button
              v-for="customer in allCustomers"
              :key="customer.id"
              type="button"
              class="w-full px-3 py-2 text-left text-sm hover:bg-slate-800 transition-colors"
              :class="{
                'bg-slate-800': customer.id === props.modelValue,
              }"
              @click="selectCustomer(customer.id, customer.name)"
            >
              {{ customer.name }}
            </button>

            <div
              v-if="hasNextPage"
              class="p-2 border-t border-slate-700 flex justify-center"
            >
              <Button
                type="button"
                variant="ghost"
                size="sm"
                :disabled="isFetchingNextPage"
                @click="handleLoadMore"
              >
                {{ isFetchingNextPage ? '加载中...' : '加载更多' }}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div
        v-if="isOpen"
        class="fixed inset-0 z-40"
        @click="isOpen = false"
      />
    </div>
    <input
      type="hidden"
      :value="props.modelValue"
      :required="props.required"
    />
  </div>
</template>
