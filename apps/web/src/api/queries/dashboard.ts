import { useQuery } from '@tanstack/vue-query';
import { computed } from 'vue';
import { apiClient } from '../client.js';
import { useMeQuery } from './auth.js';

export const dashboardKeys = {
  summary: (userId?: string) =>
    ['dashboard', userId ?? 'anon', 'summary'] as const,
};

export function useDashboardSummaryQuery() {
  const { data: meData } = useMeQuery();
  const userId = computed(() => meData.value?.id);

  return useQuery({
    queryKey: computed(() => dashboardKeys.summary(userId.value)),
    queryFn: async () => {
      const { data, error } = await apiClient.GET('/api/v1/dashboard/summary');
      if (error) throw new Error('Failed to fetch dashboard summary');
      return data;
    },
    enabled: computed(() => !!userId.value),
  });
}
