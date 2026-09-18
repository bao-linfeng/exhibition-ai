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
    path: '/forgot-password',
    name: 'forgot-password',
    component: () => import('../views/auth/ForgotPasswordView.vue'),
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
      {
        path: 'projects/:id/brief',
        name: 'brief',
        component: () => import('../views/briefs/BriefView.vue'),
      },
      {
        path: 'projects/:id/brief/edit',
        name: 'brief-edit',
        component: () => import('../views/briefs/BriefEditView.vue'),
      },
      {
        path: 'projects/:id/brief/history',
        name: 'brief-history',
        component: () => import('../views/briefs/BriefHistoryView.vue'),
      },
      {
        path: 'projects/:id/assets',
        name: 'project-assets',
        component: () => import('../views/projects/ProjectAssetsView.vue'),
      },
      {
        path: 'projects/:id/directions',
        name: 'project-directions',
        component: () => import('../views/directions/DirectionsView.vue'),
      },
      {
        path: 'projects/:id/design',
        name: 'project-design',
        component: () => import('../views/design/DesignWorkspaceView.vue'),
      },
      {
        path: 'projects/:id/versions',
        name: 'project-versions',
        component: () => import('../views/image-versions/VersionsView.vue'),
      },
      {
        path: 'projects/:id/exports',
        name: 'project-exports',
        component: () => import('../views/exports/ExportsView.vue'),
      },
      {
        path: 'projects/:id/edit',
        name: 'project-edit',
        component: () => import('../views/projects/ProjectEditView.vue'),
      },
      {
        path: 'tasks',
        name: 'tasks',
        component: () => import('../views/tasks/TasksView.vue'),
      },
      {
        path: 'cases',
        name: 'cases',
        component: () => import('../views/cases/CasesView.vue'),
      },
      {
        path: 'settings',
        name: 'settings',
        component: () => import('../views/settings/SettingsView.vue'),
      },
    ],
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'not-found',
    component: () => import('../views/NotFoundView.vue'),
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
        const safeFullPath =
          to.fullPath.startsWith('/') && !to.fullPath.startsWith('//')
            ? to.fullPath
            : '/dashboard';
        next({ path: '/login', query: { redirect: safeFullPath } });
        return;
      }
    } catch {
      const safeFullPath =
        to.fullPath.startsWith('/') && !to.fullPath.startsWith('//')
          ? to.fullPath
          : '/dashboard';
      next({ path: '/login', query: { redirect: safeFullPath } });
      return;
    }
  }

  if (['/login', '/forgot-password'].includes(to.path)) {
    try {
      const { apiClient } = await import('../api/client.js');
      const { error } = await apiClient.GET('/api/v1/auth/me');
      if (!error) {
        next('/dashboard');
        return;
      }
    } catch {
      // 保持在 auth 页
    }
  }

  next();
});
