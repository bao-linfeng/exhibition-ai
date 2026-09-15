import { computed } from 'vue';
import { useRouter } from 'vue-router';
import {
  useMeQuery,
  useLoginMutation,
  useLogoutMutation,
} from '../api/queries/auth.js';
import { useUserStore } from '../stores/user.js';

export function useAuth() {
  const router = useRouter();
  const userStore = useUserStore();

  const { data: user, isLoading, error, refetch } = useMeQuery();
  const loginMutation = useLoginMutation();
  const logoutMutation = useLogoutMutation();

  const isAuthenticated = computed(() => !!user.value);

  async function login(email: string, password: string) {
    const result = await loginMutation.mutateAsync({ email, password });
    if (result.data) {
      userStore.setUser(result.data);
    }
    return result;
  }

  async function logout() {
    await logoutMutation.mutateAsync();
    userStore.clearUser();
    router.push('/login');
  }

  return {
    user,
    isAuthenticated,
    isLoading,
    error,
    login,
    logout,
    refetch,
    loginError: computed(() => loginMutation.error.value),
    isLoginPending: computed(() => loginMutation.isPending.value),
  };
}
