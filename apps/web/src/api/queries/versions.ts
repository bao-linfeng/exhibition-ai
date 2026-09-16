import { queryOptions, useMutation, useQueryClient } from '@tanstack/vue-query';
import { apiClient } from '../client.js';
import type { UpdateSelectedVersionRequest } from '@exhibition/contracts';

export const versionKeys = {
  all: ['versions'] as const,
  lists: () => [...versionKeys.all, 'list'] as const,
  list: (projectId: string, filters: Record<string, unknown> = {}) =>
    [...versionKeys.lists(), projectId, filters] as const,
  detail: (id: string) => [...versionKeys.all, 'detail', id] as const,
};

export function listVersionsOptions(
  projectId: string,
  params?: {
    parentVersionId?: string | 'root';
    briefRevisionId?: string;
    cursor?: string;
    limit?: number;
  },
) {
  return queryOptions({
    queryKey: versionKeys.list(projectId, params ?? {}),
    queryFn: async () => {
      const { data, error } = await apiClient.GET(
        '/api/v1/projects/{projectId}/versions',
        {
          params: { path: { projectId }, query: params },
        },
      );
      if (error) throw new Error('Failed to fetch versions');
      return data;
    },
  });
}

export function versionDetailOptions(id: string) {
  return queryOptions({
    queryKey: versionKeys.detail(id),
    queryFn: async () => {
      const { data, error } = await apiClient.GET('/api/v1/versions/{id}', {
        params: { path: { id } },
      });
      if (error) throw new Error('Failed to fetch version');
      return data;
    },
  });
}

export function useUpdateSelectedVersion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      projectId: string;
      body: UpdateSelectedVersionRequest;
    }) => {
      const { data, error } = await apiClient.PUT(
        '/api/v1/projects/{projectId}/selected-version',
        {
          params: { path: { projectId: params.projectId } },
          body: params.body,
        },
      );
      if (error) {
        const errorStr = JSON.stringify(error);
        if (errorStr.includes('409')) {
          throw new Error('选图冲突：项目已被其他用户修改，请刷新后重试');
        }
        if (errorStr.includes('404')) {
          throw new Error('版本不存在');
        }
        throw new Error('更新选中版本失败');
      }
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: versionKeys.list(variables.projectId),
      });
      queryClient.invalidateQueries({
        queryKey: ['projects', 'detail', variables.projectId],
      });
    },
  });
}

export function useHideVersion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { id: string; projectId: string }) => {
      const { error } = await apiClient.POST('/api/v1/versions/{id}/hide', {
        params: { path: { id: params.id } },
        body: {},
      });
      if (error) {
        const errorStr = JSON.stringify(error);
        if (errorStr.includes('409')) {
          throw new Error('版本已隐藏');
        }
        throw new Error('隐藏版本失败');
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: versionKeys.list(variables.projectId),
      });
    },
  });
}
