import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query';
import { apiClient } from '../client.js';

export const authKeys = {
  me: () => ['auth', 'me'] as const,
};

export function useLoginMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (credentials: { email: string; password: string }) => {
      const { data, error } = await apiClient.POST('/api/v1/auth/login', {
        body: credentials,
      });
      if (error) {
        throw new Error('Login failed');
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: authKeys.me() });
    },
  });
}

export function useMeQuery(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: authKeys.me(),
    queryFn: async () => {
      const { data, error } = await apiClient.GET('/api/v1/auth/me');
      if (error) {
        throw new Error('Failed to fetch user');
      }
      return data.data;
    },
    retry: false,
    staleTime: 5 * 60 * 1000,
    ...options,
  });
}

export function useLogoutMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { error } = await apiClient.POST('/api/v1/auth/logout');
      if (error) {
        throw new Error('Logout failed');
      }
    },
    onSuccess: () => {
      queryClient.setQueryData(authKeys.me(), null);
      queryClient.invalidateQueries({ queryKey: authKeys.me() });
    },
  });
}

export function useSendCodeMutation() {
  return useMutation({
    mutationFn: async (params: {
      email: string;
      type: 'register' | 'reset_password';
    }) => {
      const { data, error } = await apiClient.POST('/api/v1/auth/send-code', {
        body: params,
      });
      if (error) throw error;
      return data;
    },
  });
}

export function useRegisterMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      email: string;
      code: string;
      displayName: string;
      password: string;
    }) => {
      const { data, error } = await apiClient.POST('/api/v1/auth/register', {
        body: params,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: authKeys.me() });
    },
  });
}

export function useForgotPasswordMutation() {
  return useMutation({
    mutationFn: async (params: {
      email: string;
      code: string;
      newPassword: string;
    }) => {
      const { data, error } = await apiClient.POST(
        '/api/v1/auth/forgot-password',
        {
          body: params,
        },
      );
      if (error) throw error;
      return data;
    },
  });
}
