import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query';

export const favoriteKeys = {
  assets: (projectId: string) => ['favorites', 'assets', projectId] as const,
  versions: (projectId: string) =>
    ['favorites', 'versions', projectId] as const,
};

export function useAssetFavoritesQuery(projectId: string) {
  return useQuery({
    queryKey: favoriteKeys.assets(projectId),
    queryFn: async () => {
      const res = await fetch(
        `/api/v1/projects/${projectId}/favorites/assets`,
        {
          credentials: 'include',
        },
      );
      if (!res.ok) throw new Error('Failed to fetch asset favorites');
      return res.json() as Promise<{
        data: Array<{ assetId: string; projectId: string; createdAt: string }>;
        page: { nextCursor: string | null; hasMore: boolean };
      }>;
    },
    enabled: !!projectId,
  });
}

export function useToggleAssetFavoriteMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      projectId,
      assetId,
      favorited,
    }: {
      projectId: string;
      assetId: string;
      favorited: boolean;
    }) => {
      const method = favorited ? 'PUT' : 'DELETE';
      const res = await fetch(
        `/api/v1/projects/${projectId}/favorites/assets/${assetId}`,
        { method, credentials: 'include' },
      );
      if (!res.ok) throw new Error('Failed to toggle favorite');
    },
    onSuccess: (_, { projectId }) => {
      queryClient.invalidateQueries({
        queryKey: favoriteKeys.assets(projectId),
      });
      queryClient.invalidateQueries({ queryKey: ['cases'] });
    },
  });
}

export function useVersionFavoritesQuery(projectId: string) {
  return useQuery({
    queryKey: favoriteKeys.versions(projectId),
    queryFn: async () => {
      const res = await fetch(
        `/api/v1/projects/${projectId}/favorites/versions`,
        {
          credentials: 'include',
        },
      );
      if (!res.ok) throw new Error('Failed to fetch version favorites');
      return res.json() as Promise<{
        data: Array<{
          versionId: string;
          projectId: string;
          createdAt: string;
        }>;
        page: { nextCursor: string | null; hasMore: boolean };
      }>;
    },
    enabled: !!projectId,
  });
}

export function useToggleVersionFavoriteMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      projectId,
      versionId,
      favorited,
    }: {
      projectId: string;
      versionId: string;
      favorited: boolean;
    }) => {
      const method = favorited ? 'PUT' : 'DELETE';
      const res = await fetch(
        `/api/v1/projects/${projectId}/favorites/versions/${versionId}`,
        { method, credentials: 'include' },
      );
      if (!res.ok) throw new Error('Failed to toggle version favorite');
    },
    onSuccess: (_, { projectId }) => {
      queryClient.invalidateQueries({
        queryKey: favoriteKeys.versions(projectId),
      });
      queryClient.invalidateQueries({ queryKey: ['cases'] });
    },
  });
}
