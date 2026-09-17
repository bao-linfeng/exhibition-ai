import {
  queryOptions,
  useMutation,
  useQueryClient,
  useInfiniteQuery,
} from '@tanstack/vue-query';
import { apiClient } from '../client.js';

export const exportKeys = {
  all: ['exports'] as const,
  lists: () => [...exportKeys.all, 'list'] as const,
  list: (projectId: string, filters: Record<string, unknown> = {}) =>
    [...exportKeys.lists(), projectId, filters] as const,
  detail: (projectId: string, id: string) =>
    [...exportKeys.all, 'detail', projectId, id] as const,
};

export function listExportsOptions(
  projectId: string,
  params?: {
    cursor?: string;
    limit?: number;
  },
  refetchInterval?: number | false,
) {
  return queryOptions({
    queryKey: exportKeys.list(projectId, params ?? {}),
    queryFn: async () => {
      const { data, error } = await apiClient.GET(
        '/api/v1/projects/{projectId}/exports',
        {
          params: { path: { projectId }, query: params },
        },
      );
      if (error) throw new Error('Failed to fetch exports');
      return data;
    },
    refetchInterval: refetchInterval ?? false,
  });
}

export function useInfiniteExportsQuery(
  projectId: string,
  params?: { limit?: number },
  refetchInterval?: number | false,
) {
  return useInfiniteQuery({
    queryKey: exportKeys.list(projectId, params ?? {}),
    queryFn: async ({ pageParam }) => {
      const { data, error } = await apiClient.GET(
        '/api/v1/projects/{projectId}/exports',
        {
          params: {
            path: { projectId },
            query: { ...params, cursor: pageParam },
          },
        },
      );
      if (error) throw new Error('Failed to fetch exports');
      return data;
    },
    getNextPageParam: (lastPage) => lastPage?.page.nextCursor || undefined,
    initialPageParam: undefined as string | undefined,
    refetchInterval: refetchInterval ?? false,
  });
}

export function exportDetailOptions(
  projectId: string,
  exportId: string,
  refetchInterval?: number | false,
) {
  return queryOptions({
    queryKey: exportKeys.detail(projectId, exportId),
    queryFn: async () => {
      const { data, error } = await apiClient.GET(
        '/api/v1/projects/{projectId}/exports/{exportId}',
        {
          params: { path: { projectId, exportId } },
        },
      );
      if (error) throw new Error('Failed to fetch export details');
      return data;
    },
    refetchInterval: refetchInterval ?? false,
  });
}

export function useCreateExport() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      projectId: string;
      versionIds: string[];
      format?: 'zip' | 'pdf';
    }) => {
      const { data, error } = await apiClient.POST(
        '/api/v1/projects/{projectId}/exports',
        {
          params: { path: { projectId: params.projectId } },
          body: {
            versionIds: params.versionIds,
            format: params.format,
          },
        },
      );
      if (error) {
        throw new Error('Failed to create export');
      }
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: exportKeys.list(variables.projectId),
      });
    },
  });
}

export function useGetExportDownloadUrl() {
  return useMutation({
    mutationFn: async (params: { projectId: string; exportId: string }) => {
      const { data, error } = await apiClient.GET(
        '/api/v1/projects/{projectId}/exports/{exportId}/download',
        {
          params: {
            path: { projectId: params.projectId, exportId: params.exportId },
          },
        },
      );
      if (error) {
        throw new Error('Failed to get download URL');
      }
      return data.data.url;
    },
  });
}
