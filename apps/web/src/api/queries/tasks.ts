import {
  queryOptions,
  useMutation,
  useQueryClient,
  useInfiniteQuery,
} from '@tanstack/vue-query';
import { apiClient } from '../client.js';
import type { TaskKind, TaskStatus } from '@exhibition/contracts';

export const taskKeys = {
  all: ['tasks'] as const,
  lists: () => [...taskKeys.all, 'list'] as const,
  list: (filters: Record<string, unknown> = {}) =>
    [...taskKeys.lists(), filters] as const,
  detail: (id: string) => [...taskKeys.all, 'detail', id] as const,
};

export function listTasksOptions(
  params?: {
    projectId?: string;
    kind?: TaskKind;
    status?: TaskStatus;
    cursor?: string;
    limit?: number;
  },
  refetchInterval?: number | false,
) {
  return queryOptions({
    queryKey: taskKeys.list(params ?? {}),
    queryFn: async () => {
      const { data, error } = await apiClient.GET('/api/v1/tasks', {
        params: { query: params },
      });
      if (error) throw new Error('Failed to fetch tasks');
      return data;
    },
    refetchInterval: refetchInterval ?? false,
  });
}

export function useInfiniteTasksQuery(
  params: {
    projectId?: string;
    kind?: TaskKind;
    status?: TaskStatus;
    limit?: number;
  },
  refetchInterval?: number | false,
) {
  return useInfiniteQuery({
    queryKey: taskKeys.list(params),
    queryFn: async ({ pageParam }) => {
      const { data, error } = await apiClient.GET('/api/v1/tasks', {
        params: {
          query: {
            ...params,
            cursor: pageParam,
          },
        },
      });
      if (error) throw new Error('Failed to fetch tasks');
      return data;
    },
    getNextPageParam: (lastPage) => lastPage?.page.nextCursor || undefined,
    initialPageParam: undefined as string | undefined,
    refetchInterval: refetchInterval ?? false,
  });
}

export function useCancelTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await apiClient.POST(
        '/api/v1/tasks/{id}/cancel',
        {
          params: { path: { id } },
        },
      );
      if (error) throw new Error('Failed to cancel task');
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: taskKeys.lists() });
    },
  });
}

export function useRetryTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await apiClient.POST('/api/v1/tasks/{id}/retry', {
        params: { path: { id } },
        body: {},
      });
      if (error) throw new Error('Failed to retry task');
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: taskKeys.lists() });
    },
  });
}
