import {
  queryOptions,
  useMutation,
  useQueryClient,
  useInfiniteQuery,
} from '@tanstack/vue-query';
import { apiClient } from '../client.js';
import type { AuditEventType } from '@exhibition/contracts';

type UserRole = 'admin' | 'designer' | 'sales' | 'viewer';
type UserStatus = 'enabled' | 'disabled';

export const settingsKeys = {
  all: ['settings'] as const,
  users: () => [...settingsKeys.all, 'users'] as const,
  userList: (filters: Record<string, unknown> = {}) =>
    [...settingsKeys.users(), 'list', filters] as const,
  models: () => [...settingsKeys.all, 'models'] as const,
  quota: () => [...settingsKeys.all, 'quota'] as const,
  audit: () => [...settingsKeys.all, 'audit'] as const,
  auditList: (filters: Record<string, unknown> = {}) =>
    [...settingsKeys.audit(), 'list', filters] as const,
};

// Users

export function listUsersOptions(params?: {
  role?: UserRole;
  status?: UserStatus;
  search?: string;
  cursor?: string;
  limit?: number;
}) {
  return queryOptions({
    queryKey: settingsKeys.userList(params ?? {}),
    queryFn: async () => {
      const { data, error } = await apiClient.GET('/api/v1/users', {
        params: { query: params },
      });
      if (error) throw new Error('Failed to fetch users');
      return data;
    },
  });
}

export function useInfiniteUsersQuery(params: {
  role?: UserRole;
  status?: UserStatus;
  search?: string;
  limit?: number;
}) {
  return useInfiniteQuery({
    queryKey: settingsKeys.userList(params),
    queryFn: async ({ pageParam }) => {
      const { data, error } = await apiClient.GET('/api/v1/users', {
        params: {
          query: {
            ...params,
            cursor: pageParam,
          },
        },
      });
      if (error) throw new Error('Failed to fetch users');
      return data;
    },
    getNextPageParam: (lastPage) => lastPage?.page.nextCursor || undefined,
    initialPageParam: undefined as string | undefined,
  });
}

export function useUpdateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      body,
    }: {
      id: string;
      body: { role?: UserRole; status?: UserStatus; expectedRevision: number };
    }) => {
      const { data, error } = await apiClient.PATCH('/api/v1/users/{id}', {
        params: { path: { id } },
        body,
      });
      if (error) throw new Error('Failed to update user');
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: settingsKeys.users() });
    },
  });
}

// Models

export function listModelConfigsOptions() {
  return queryOptions({
    queryKey: settingsKeys.models(),
    queryFn: async () => {
      const { data, error } = await apiClient.GET('/api/v1/models');
      if (error) throw new Error('Failed to fetch models');
      return data;
    },
  });
}

export function useUpdateModelConfig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      body,
    }: {
      id: string;
      body: {
        isActive?: boolean;
        maxConcurrent?: number;
        costPerImageMinor?: number;
        displayName?: string;
        description?: string;
      };
    }) => {
      const { data, error } = await apiClient.PATCH(
        '/api/v1/settings/model-configs/{id}',
        {
          params: { path: { id } },
          body,
        },
      );
      if (error) throw new Error('Failed to update model config');
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: settingsKeys.models() });
    },
  });
}

// Quota

export function getQuotaOptions() {
  return queryOptions({
    queryKey: settingsKeys.quota(),
    queryFn: async () => {
      const { data, error } = await apiClient.GET('/api/v1/settings/quota');
      if (error) throw new Error('Failed to fetch quota');
      return data;
    },
  });
}

export function useTopupQuota() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (body: {
      ownerType: 'system' | 'user';
      ownerId?: string;
      amountMinor: number;
      currency: string;
      reason: string;
    }) => {
      const { data, error } = await apiClient.POST(
        '/api/v1/settings/quota/topup',
        {
          body,
        },
      );
      if (error) throw new Error('Failed to topup quota');
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: settingsKeys.quota() });
    },
  });
}

// Audit Logs

export function listAuditLogsOptions(params?: {
  eventType?: AuditEventType;
  actorId?: string;
  projectId?: string;
  resourceType?: string;
  startDate?: string;
  endDate?: string;
  cursor?: string;
  limit?: number;
}) {
  return queryOptions({
    queryKey: settingsKeys.auditList(params ?? {}),
    queryFn: async () => {
      const { data, error } = await apiClient.GET('/api/v1/audit-logs', {
        params: { query: params },
      });
      if (error) throw new Error('Failed to fetch audit logs');
      return data;
    },
  });
}

export function useInfiniteAuditLogsQuery(params: {
  eventType?: AuditEventType;
  actorId?: string;
  projectId?: string;
  resourceType?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
}) {
  return useInfiniteQuery({
    queryKey: settingsKeys.auditList(params),
    queryFn: async ({ pageParam }) => {
      const { data, error } = await apiClient.GET('/api/v1/audit-logs', {
        params: {
          query: {
            ...params,
            cursor: pageParam,
          },
        },
      });
      if (error) throw new Error('Failed to fetch audit logs');
      return data;
    },
    getNextPageParam: (lastPage) => lastPage?.page.nextCursor || undefined,
    initialPageParam: undefined as string | undefined,
  });
}
