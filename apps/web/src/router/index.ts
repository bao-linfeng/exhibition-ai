import { createRouter, createWebHistory } from 'vue-router';
import type { RouteRecordRaw } from 'vue-router';
import AppLayout from '../layouts/AppLayout.vue';

const routes: RouteRecordRaw[] = [
  {
    path: '/login',
    name: 'login',
    component: () => import('../views/auth/LoginView.vue'),
    meta: { requiresAuth: false },
  },
  {
    path: '/',
    component: AppLayout,
    meta: { requiresAuth: true },
    children: [
      {
        path: '',
        name: 'home',
        redirect: '/dashboard',
      },
      {
        path: 'dashboard',
        name: 'dashboard',
        component: () => import('../views/dashboard/DashboardView.vue'),
      },
      {
        path: 'customers',
        name: 'customers',
        component: () => import('../views/customers/CustomersView.vue'),
      },
      {
        path: 'customers/new',
        name: 'customer-new',
        component: () => import('../views/customers/CustomerFormView.vue'),
      },
      {
        path: 'customers/:id',
        name: 'customer-detail',
        component: () => import('../views/customers/CustomerDetailView.vue'),
      },
      {
        path: 'customers/:id/edit',
        name: 'customer-edit',
        component: () => import('../views/customers/CustomerFormView.vue'),
      },
      {
        path: 'projects',
        name: 'projects',
        component: () => import('../views/projects/ProjectsView.vue'),
      },
      {
        path: 'projects/new',
        name: 'project-new',
        component: () => import('../views/projects/ProjectFormView.vue'),
      },
      {
        path: 'projects/:id',
        name: 'project-detail',
        component: () => import('../views/projects/ProjectDetailView.vue'),
      },
    ],
  },
];

export const router = createRouter({
  history: createWebHistory(),
  routes,
});

router.beforeEach(async (to, from, next) => {
  const requiresAuth = to.meta.requiresAuth !== false;

  if (requiresAuth && to.path !== '/login') {
    try {
      const { apiClient } = await import('../api/client.js');
      const { error } = await apiClient.GET('/api/v1/auth/me');
      if (error) {
        next({ path: '/login', query: { redirect: to.fullPath } });
        return;
      }
    } catch {
      next({ path: '/login', query: { redirect: to.fullPath } });
      return;
    }
  }

  if (to.path === '/login') {
    try {
      const { apiClient } = await import('../api/client.js');
      const { error } = await apiClient.GET('/api/v1/auth/me');
      if (!error) {
        next('/dashboard');
        return;
      }
    } catch {
      // 保持在登录页
    }
  }

  next();
});
