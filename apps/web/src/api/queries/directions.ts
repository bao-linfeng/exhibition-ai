import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query';
import { computed, toValue, type MaybeRefOrGetter } from 'vue';
import { apiClient } from '../client.js';
import { projectKeys } from './projects.js';

export const directionKeys = {
  all: (projectId: string) => ['directions', projectId] as const,
  list: (projectId: string, briefRevisionId?: string) =>
    [...directionKeys.all(projectId), 'list', briefRevisionId ?? ''] as const,
  detail: (projectId: string, directionId: string) =>
    [...directionKeys.all(projectId), directionId] as const,
};

export function useDirectionsQuery(
  projectId: MaybeRefOrGetter<string>,
  briefRevisionId?: MaybeRefOrGetter<string | undefined>,
) {
  const resolvedProjectId = computed(() => toValue(projectId));
  const resolvedBriefRevisionId = computed(() => toValue(briefRevisionId));

  return useQuery({
    queryKey: computed(() =>
      directionKeys.list(
        resolvedProjectId.value,
        resolvedBriefRevisionId.value,
      ),
    ),
    queryFn: async () => {
      const { data, error } = await apiClient.GET(
        '/api/v1/projects/{projectId}/design-directions',
        {
          params: {
            path: { projectId: resolvedProjectId.value },
            query: {
              briefRevisionId: resolvedBriefRevisionId.value,
              limit: 50,
            },
          },
        },
      );
      if (error) throw new Error('Failed to fetch design directions');
      return data;
    },
    enabled: computed(() => !!resolvedProjectId.value),
  });
}

export function useCreateDirectionsMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      projectId,
      body,
    }: {
      projectId: string;
      body: {
        briefRevisionId: string;
        inputAssetIds?: string[];
        count?: number;
      };
    }) => {
      const { data, error } = await apiClient.POST(
        '/api/v1/projects/{projectId}/design-directions',
        {
          params: { path: { projectId } },
          body,
        },
      );
      if (error) throw new Error('Failed to create design directions');
      return data.data;
    },
    onSuccess: (_, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: directionKeys.all(projectId) });
      queryClient.invalidateQueries({
        queryKey: projectKeys.detail(projectId),
      });
    },
  });
}
