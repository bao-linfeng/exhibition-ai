import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/vue-query';
import { computed, toValue, type MaybeRefOrGetter } from 'vue';
import { apiClient } from '../client.js';
import type { paths } from '@exhibition/api-client';

type CreateCustomerBody =
  paths['/api/v1/customers']['post']['requestBody']['content']['application/json'];
type UpdateCustomerBody =
  paths['/api/v1/customers/{id}']['patch']['requestBody']['content']['application/json'];

type CustomersQueryParams = {
  status?: 'active' | 'inactive';
  search?: string;
  cursor?: string;
};

export const customerKeys = {
  all: () => ['customers'] as const,
  lists: () => [...customerKeys.all(), 'list'] as const,
  list: (params: Record<string, unknown>) =>
    [...customerKeys.lists(), params] as const,
  details: () => [...customerKeys.all(), 'detail'] as const,
  detail: (id: string) => [...customerKeys.details(), id] as const,
};

export function useCustomersQuery(
  params?: MaybeRefOrGetter<CustomersQueryParams | undefined>,
) {
  const resolvedParams = computed(() => toValue(params));
  return useQuery({
    queryKey: computed(() => customerKeys.list(resolvedParams.value || {})),
    queryFn: async () => {
      const p = resolvedParams.value;
      const { data, error } = await apiClient.GET('/api/v1/customers', {
        params: {
          query: p,
        },
      });
      if (error) throw new Error('Failed to fetch customers');
      return data;
    },
  });
}

export function useInfiniteCustomersQuery(
  params?: MaybeRefOrGetter<Omit<CustomersQueryParams, 'cursor'> | undefined>,
) {
  const resolvedParams = computed(() => toValue(params));
  return useInfiniteQuery({
    queryKey: computed(() => [
      ...customerKeys.lists(),
      'infinite',
      resolvedParams.value || {},
    ]),
    queryFn: async ({ pageParam }) => {
      const p = resolvedParams.value;
      const { data, error } = await apiClient.GET('/api/v1/customers', {
        params: {
          query: { ...p, cursor: pageParam },
        },
      });
      if (error) throw new Error('Failed to fetch customers');
      return data;
    },
    getNextPageParam: (lastPage) => lastPage.page.nextCursor ?? undefined,
    initialPageParam: undefined as string | undefined,
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
    mutationFn: async ({
      id,
      body,
    }: {
      id: string;
      body: UpdateCustomerBody;
    }) => {
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
