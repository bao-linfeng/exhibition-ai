import { useQuery } from '@tanstack/vue-query';
import { apiClient } from '../client.js';

export const dashboardKeys = {
  summary: () => ['dashboard', 'summary'] as const,
};

export function useDashboardSummaryQuery() {
  return useQuery({
    queryKey: dashboardKeys.summary(),
    queryFn: async () => {
      const { data, error } = await apiClient.GET('/api/v1/dashboard/summary');
      if (error) throw new Error('Failed to fetch dashboard summary');
      return data;
    },
  });
}
