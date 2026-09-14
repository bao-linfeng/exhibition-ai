import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query';
import { apiClient } from '../client.js';
import type { paths } from '@exhibition/api-client';

type CreateCustomerBody = paths['/api/v1/customers']['post']['requestBody']['content']['application/json'];
type UpdateCustomerBody = paths['/api/v1/customers/{id}']['patch']['requestBody']['content']['application/json'];

export const customerKeys = {
  all: () => ['customers'] as const,
  lists: () => [...customerKeys.all(), 'list'] as const,
  list: (params: Record<string, unknown>) => [...customerKeys.lists(), params] as const,
  details: () => [...customerKeys.all(), 'detail'] as const,
  detail: (id: string) => [...customerKeys.details(), id] as const,
};

export function useCustomersQuery(params?: { status?: 'active' | 'inactive'; search?: string; cursor?: string }) {
  return useQuery({
    queryKey: customerKeys.list(params || {}),
    queryFn: async () => {
      const { data, error } = await apiClient.GET('/api/v1/customers', {
        params: {
          query: params,
        },
      });
      if (error) throw new Error('Failed to fetch customers');
      return data;
    },
  });
}

export function useCustomerQuery(id: string) {
  return useQuery({
    queryKey: customerKeys.detail(id),
    queryFn: async () => {
      const { data, error } = await apiClient.GET('/api/v1/customers/{id}', {
        params: {
          path: { id },
        },
      });
      if (error) throw new Error('Failed to fetch customer');
      return data.data;
    },
    enabled: !!id,
  });
}

export function useCreateCustomerMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: CreateCustomerBody) => {
      const { data, error } = await apiClient.POST('/api/v1/customers', {
        body,
      });
      if (error) throw new Error('Failed to create customer');
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: customerKeys.lists() });
    },
  });
}

export function useUpdateCustomerMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, body }: { id: string; body: UpdateCustomerBody }) => {
      const { data, error } = await apiClient.PATCH('/api/v1/customers/{id}', {
        params: { path: { id } },
        body,
      });
      if (error) throw new Error('Failed to update customer');
      return data.data;
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: customerKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: customerKeys.lists() });
    },
  });
}
