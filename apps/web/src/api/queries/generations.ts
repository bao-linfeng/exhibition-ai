import { queryOptions, useMutation, useQueryClient } from '@tanstack/vue-query';
import { apiClient } from '../client.js';
import type { CreateGenerationRequest } from '@exhibition/contracts';

export const generationKeys = {
  all: ['generations'] as const,
  lists: () => [...generationKeys.all, 'list'] as const,
  list: (projectId: string, filters: Record<string, unknown> = {}) =>
    [...generationKeys.lists(), projectId, filters] as const,
};

export function listGenerationsOptions(
  projectId: string,
  params?: {
    status?:
      | 'pending'
      | 'queued'
      | 'running'
      | 'succeeded'
      | 'partially_succeeded'
      | 'failed'
      | 'cancelled';
    cursor?: string;
    limit?: number;
  },
) {
  return queryOptions({
    queryKey: generationKeys.list(projectId, params ?? {}),
    queryFn: async () => {
      const { data, error } = await apiClient.GET(
        '/api/v1/projects/{projectId}/generations',
        {
          params: { path: { projectId }, query: params },
        },
      );
      if (error) throw new Error('Failed to fetch generations');
      return data;
    },
  });
}

export function useCreateGeneration() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      projectId: string;
      body: CreateGenerationRequest;
    }) => {
      const { data, error } = await apiClient.POST(
        '/api/v1/projects/{projectId}/generations',
        {
          params: { path: { projectId: params.projectId } },
          body: params.body,
        },
      );
      if (error) {
        const errorStr = JSON.stringify(error);
        if (errorStr.includes('409')) {
          throw new Error('请求冲突，可能是重复提交');
        }
        if (errorStr.includes('429')) {
          throw new Error('配额不足，请稍后再试');
        }
        throw new Error('创建生成任务失败');
      }
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: generationKeys.list(variables.projectId),
      });
    },
  });
}
