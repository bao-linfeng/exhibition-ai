import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query';
import { computed, toValue, type MaybeRefOrGetter } from 'vue';
import { apiClient } from '../client.js';
import type { paths } from '@exhibition/api-client';
import { projectKeys } from './projects.js';

type UpdateBriefRequest =
  paths['/api/v1/projects/{projectId}/brief']['put']['requestBody']['content']['application/json'];
type ConfirmBriefRequest = {
  briefRevisionId: string;
  expectedRevision: number;
};

export const briefKeys = {
  all: (projectId: string) => ['briefs', projectId] as const,
  current: (projectId: string) =>
    [...briefKeys.all(projectId), 'current'] as const,
  revisions: (projectId: string) =>
    [...briefKeys.all(projectId), 'revisions'] as const,
  revision: (projectId: string, revisionId: string) =>
    [...briefKeys.revisions(projectId), revisionId] as const,
};

export function useBriefQuery(projectId: MaybeRefOrGetter<string>) {
  const resolvedId = computed(() => toValue(projectId));
  return useQuery({
    queryKey: computed(() => briefKeys.current(resolvedId.value)),
    queryFn: async () => {
      const { data, error } = await apiClient.GET(
        '/api/v1/projects/{projectId}/brief',
        {
          params: {
            path: { projectId: resolvedId.value },
          },
        },
      );
      if (error) throw new Error('Failed to fetch brief');
      return data.data;
    },
    enabled: computed(() => !!resolvedId.value),
  });
}

export function useBriefRevisionsQuery(projectId: MaybeRefOrGetter<string>) {
  const resolvedId = computed(() => toValue(projectId));
  return useQuery({
    queryKey: computed(() => briefKeys.revisions(resolvedId.value)),
    queryFn: async () => {
      const { data, error } = await apiClient.GET(
        '/api/v1/projects/{projectId}/brief/revisions',
        {
          params: {
            path: { projectId: resolvedId.value },
          },
        },
      );
      if (error) throw new Error('Failed to fetch brief revisions');
      return data;
    },
    enabled: computed(() => !!resolvedId.value),
  });
}

export function useUpdateBriefMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      projectId,
      body,
    }: {
      projectId: string;
      body: UpdateBriefRequest;
    }) => {
      const { data, error } = await apiClient.PUT(
        '/api/v1/projects/{projectId}/brief',
        {
          params: { path: { projectId } },
          body,
        },
      );
      if (error) {
        const err = error as Record<string, unknown>;
        if (err.message === 'Revision conflict' || err.statusCode === 409) {
          throw new Error('conflict');
        }
        throw new Error('Failed to update brief');
      }
      return data.data;
    },
    onSuccess: (_, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: briefKeys.current(projectId) });
      queryClient.invalidateQueries({
        queryKey: briefKeys.revisions(projectId),
      });
      queryClient.invalidateQueries({
        queryKey: projectKeys.detail(projectId),
      });
    },
  });
}

export function useConfirmBriefMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      projectId,
      body,
    }: {
      projectId: string;
      body: ConfirmBriefRequest;
    }) => {
      const { data, error } = await apiClient.POST(
        '/api/v1/projects/{projectId}/brief/confirm',
        {
          params: { path: { projectId } },
          body,
        },
      );
      if (error) {
        const err = error as Record<string, unknown>;
        if (err.message === 'Revision conflict' || err.statusCode === 409) {
          throw new Error('conflict');
        }
        throw new Error('Failed to confirm brief');
      }
      return data.data;
    },
    onSuccess: (_, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: briefKeys.current(projectId) });
      queryClient.invalidateQueries({
        queryKey: briefKeys.revisions(projectId),
      });
      queryClient.invalidateQueries({
        queryKey: projectKeys.detail(projectId),
      });
    },
  });
}
