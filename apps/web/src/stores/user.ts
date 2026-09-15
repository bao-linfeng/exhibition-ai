import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

interface User {
  id: string;
  email: string;
  displayName: string;
  role: 'admin' | 'designer' | 'sales' | 'viewer';
  status: 'enabled' | 'disabled';
  mustChangePassword: boolean;
  createdAt: string;
}

export const useUserStore = defineStore('user', () => {
  const user = ref<User | null>(null);

  const isAuthenticated = computed(() => user.value !== null);
  const isAdmin = computed(() => user.value?.role === 'admin');
  const canManageCustomers = computed(() =>
    ['admin', 'sales'].includes(user.value?.role ?? ''),
  );
  const canCreateProject = computed(() =>
    ['admin', 'sales'].includes(user.value?.role ?? ''),
  );
  const canDeactivateCustomer = computed(() => user.value?.role === 'admin');

  function setUser(userData: User | null) {
    user.value = userData;
  }

  function clearUser() {
    user.value = null;
  }

  return {
    user,
    isAuthenticated,
    isAdmin,
    canManageCustomers,
    canCreateProject,
    canDeactivateCustomer,
    setUser,
    clearUser,
  };
});
