import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query';
import { computed, toValue, type MaybeRefOrGetter } from 'vue';
import { apiClient } from '../client.js';
import type { paths } from '@exhibition/api-client';

type CreateUploadSessionBody =
  paths['/api/v1/projects/{projectId}/assets/uploads']['post']['requestBody']['content']['application/json'];
type CompleteUploadBody =
  paths['/api/v1/projects/{projectId}/assets/uploads/{uploadId}/complete']['post']['requestBody']['content']['application/json'];
type CreateDownloadUrlBody =
  paths['/api/v1/projects/{projectId}/assets/{assetId}/download-url']['post']['requestBody']['content']['application/json'];

type AssetsQueryParams = {
  kind?: string;
  status?: string;
  includeHidden?: boolean;
  cursor?: string;
};

export const assetKeys = {
  all: (projectId: string) => ['assets', projectId] as const,
  lists: (projectId: string) => [...assetKeys.all(projectId), 'list'] as const,
  list: (projectId: string, params: Record<string, unknown>) =>
    [...assetKeys.lists(projectId), params] as const,
  details: (projectId: string) =>
    [...assetKeys.all(projectId), 'detail'] as const,
  detail: (projectId: string, assetId: string) =>
    [...assetKeys.details(projectId), assetId] as const,
};

export function useAssetsQuery(
  projectId: string,
  params?: MaybeRefOrGetter<AssetsQueryParams | undefined>,
) {
  const resolvedParams = computed(() => toValue(params));
  return useQuery({
    queryKey: computed(() =>
      assetKeys.list(projectId, resolvedParams.value || {}),
    ),
    queryFn: async () => {
      const p = resolvedParams.value;
      const { data, error } = await apiClient.GET(
        '/api/v1/projects/{projectId}/assets',
        {
          params: { path: { projectId }, query: p as Record<string, unknown> },
        },
      );
      if (error) throw new Error('Failed to fetch assets');
      return data;
    },
    enabled: !!projectId,
  });
}

export function useCreateUploadSessionMutation() {
  return useMutation({
    mutationFn: async ({
      projectId,
      body,
    }: {
      projectId: string;
      body: CreateUploadSessionBody;
    }) => {
      const { data, error } = await apiClient.POST(
        '/api/v1/projects/{projectId}/assets/uploads',
        {
          params: { path: { projectId } },
          body,
        },
      );
      if (error) throw new Error('Failed to create upload session');
      return data.data;
    },
  });
}

export function useCompleteUploadMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      projectId,
      uploadId,
      body,
    }: {
      projectId: string;
      uploadId: string;
      body: CompleteUploadBody;
    }) => {
      const { data, error } = await apiClient.POST(
        '/api/v1/projects/{projectId}/assets/uploads/{uploadId}/complete',
        {
          params: { path: { projectId, uploadId } },
          body,
        },
      );
      if (error) throw new Error('Failed to complete upload');
      return data.data;
    },
    onSuccess: (_, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: assetKeys.all(projectId) });
    },
  });
}

export function useCreateDownloadUrlMutation() {
  return useMutation({
    mutationFn: async ({
      projectId,
      assetId,
      body,
    }: {
      projectId: string;
      assetId: string;
      body: CreateDownloadUrlBody;
    }) => {
      const { data, error } = await apiClient.POST(
        '/api/v1/projects/{projectId}/assets/{assetId}/download-url',
        {
          params: { path: { projectId, assetId } },
          body,
        },
      );
      if (error) throw new Error('Failed to create download url');
      return data.data;
    },
  });
}

export function useHideAssetMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      projectId,
      assetId,
    }: {
      projectId: string;
      assetId: string;
    }) => {
      const res = await fetch(
        `/api/v1/projects/${projectId}/assets/${assetId}`,
        {
          method: 'DELETE',
          credentials: 'include',
        },
      );
      if (!res.ok) throw new Error('Failed to hide asset');
      // If we expect JSON back, we could parse it, but standard 204 or 200 is fine.
    },
    onSuccess: (_, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: assetKeys.all(projectId) });
    },
  });
}
