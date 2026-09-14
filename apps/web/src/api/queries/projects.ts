import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query';
import { apiClient } from '../client.js';
import type { paths } from '@exhibition/api-client';

type CreateProjectBody = paths['/api/v1/projects']['post']['requestBody']['content']['application/json'];
type UpdateProjectBody = paths['/api/v1/projects/{id}']['patch']['requestBody']['content']['application/json'];

export const projectKeys = {
  all: () => ['projects'] as const,
  lists: () => [...projectKeys.all(), 'list'] as const,
  list: (params: Record<string, unknown>) => [...projectKeys.lists(), params] as const,
  details: () => [...projectKeys.all(), 'detail'] as const,
  detail: (id: string) => [...projectKeys.details(), id] as const,
  members: (id: string) => [...projectKeys.detail(id), 'members'] as const,
};

export function useProjectsQuery(params?: {
  status?: 'draft' | 'briefing' | 'designing' | 'reviewing' | 'approved' | 'archived';
  customerId?: string;
  search?: string;
  cursor?: string;
}) {
  return useQuery({
    queryKey: projectKeys.list(params || {}),
    queryFn: async () => {
      const { data, error } = await apiClient.GET('/api/v1/projects', {
        params: {
          query: params,
        },
      });
      if (error) throw new Error('Failed to fetch projects');
      return data;
    },
  });
}

export function useProjectQuery(id: string) {
  return useQuery({
    queryKey: projectKeys.detail(id),
    queryFn: async () => {
      const { data, error } = await apiClient.GET('/api/v1/projects/{id}', {
        params: {
          path: { id },
        },
      });
      if (error) throw new Error('Failed to fetch project');
      return data.data;
    },
    enabled: !!id,
  });
}

export function useCreateProjectMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: CreateProjectBody) => {
      const { data, error } = await apiClient.POST('/api/v1/projects', {
        body,
      });
      if (error) throw new Error('Failed to create project');
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: projectKeys.lists() });
    },
  });
}

export function useUpdateProjectMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, body }: { id: string; body: UpdateProjectBody }) => {
      const { data, error } = await apiClient.PATCH('/api/v1/projects/{id}', {
        params: { path: { id } },
        body,
      });
      if (error) throw new Error('Failed to update project');
      return data.data;
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: projectKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: projectKeys.lists() });
    },
  });
}

export function useProjectMembersQuery(projectId: string) {
  return useQuery({
    queryKey: projectKeys.members(projectId),
    queryFn: async () => {
      const { data, error } = await apiClient.GET('/api/v1/projects/{id}/members', {
        params: { path: { id: projectId } },
      });
      if (error) throw new Error('Failed to fetch project members');
      return data.data;
    },
    enabled: !!projectId,
  });
}

export function useAddProjectMemberMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ projectId, userId }: { projectId: string; userId: string }) => {
      const { data, error } = await apiClient.POST('/api/v1/projects/{id}/members', {
        params: { path: { id: projectId } },
        body: { userId },
      });
      if (error) throw new Error('Failed to add project member');
      return data.data;
    },
    onSuccess: (_, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: projectKeys.members(projectId) });
      queryClient.invalidateQueries({ queryKey: projectKeys.detail(projectId) });
    },
  });
}

export function useRemoveProjectMemberMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ projectId, userId, expectedRevision = 0 }: { projectId: string; userId: string; expectedRevision?: number }) => {
      const { error } = await apiClient.DELETE('/api/v1/projects/{id}/members/{userId}', {
        params: { path: { id: projectId, userId } },
        body: { expectedRevision },
      });
      if (error) throw new Error('Failed to remove project member');
    },
    onSuccess: (_, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: projectKeys.members(projectId) });
      queryClient.invalidateQueries({ queryKey: projectKeys.detail(projectId) });
    },
  });
}

export const userKeys = {
  all: () => ['users'] as const,
  options: (search?: string) => [...userKeys.all(), 'options', search] as const,
};

export function useUserOptionsQuery(search?: string) {
  return useQuery({
    queryKey: userKeys.options(search),
    queryFn: async () => {
      const { data, error } = await apiClient.GET('/api/v1/users', {
        params: { query: { search, limit: 50 } },
      });
      if (error) throw new Error('Failed to fetch users');
      return data;
    },
  });
}
