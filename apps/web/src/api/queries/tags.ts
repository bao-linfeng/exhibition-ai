import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query';

export const tagKeys = {
  all: (projectId: string) => ['tags', projectId] as const,
  list: (projectId: string) => [...tagKeys.all(projectId), 'list'] as const,
};

export function useTagsQuery(projectId: string) {
  return useQuery({
    queryKey: tagKeys.list(projectId),
    queryFn: async () => {
      const res = await fetch(`/api/v1/projects/${projectId}/tags`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to fetch tags');
      return res.json() as Promise<{
        data: Array<{
          id: string;
          name: string;
          color: string | null;
          projectId: string;
          createdBy: string;
          createdAt: string;
          updatedAt: string;
        }>;
      }>;
    },
    enabled: !!projectId,
  });
}

export function useCreateTagMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      projectId,
      name,
      color,
    }: {
      projectId: string;
      name: string;
      color?: string;
    }) => {
      const res = await fetch(`/api/v1/projects/${projectId}/tags`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, color }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(
          (err as { error?: { message?: string } })?.error?.message ??
            'Failed to create tag',
        );
      }
      return res.json();
    },
    onSuccess: (_, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: tagKeys.list(projectId) });
    },
  });
}

export function useDeleteTagMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      projectId,
      tagId,
    }: {
      projectId: string;
      tagId: string;
    }) => {
      const res = await fetch(`/api/v1/projects/${projectId}/tags/${tagId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to delete tag');
    },
    onSuccess: (_, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: tagKeys.list(projectId) });
    },
  });
}

export function useAssignTagMutation() {
  return useMutation({
    mutationFn: async ({
      projectId,
      tagId,
      resourceType,
      resourceId,
    }: {
      projectId: string;
      tagId: string;
      resourceType: 'assets' | 'versions';
      resourceId: string;
    }) => {
      const res = await fetch(
        `/api/v1/projects/${projectId}/tags/${tagId}/${resourceType}/${resourceId}`,
        { method: 'PUT', credentials: 'include' },
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(
          (err as { error?: { message?: string } })?.error?.message ??
            'Failed to assign tag',
        );
      }
    },
  });
}

export function useUnassignTagMutation() {
  return useMutation({
    mutationFn: async ({
      projectId,
      tagId,
      resourceType,
      resourceId,
    }: {
      projectId: string;
      tagId: string;
      resourceType: 'assets' | 'versions';
      resourceId: string;
    }) => {
      const res = await fetch(
        `/api/v1/projects/${projectId}/tags/${tagId}/${resourceType}/${resourceId}`,
        { method: 'DELETE', credentials: 'include' },
      );
      if (!res.ok) throw new Error('Failed to unassign tag');
    },
  });
}
