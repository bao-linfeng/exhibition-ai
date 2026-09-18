import createClient, { type Middleware } from 'openapi-fetch';
import type { paths } from '@exhibition/api-client';

export const apiClient = createClient<paths>({
  credentials: 'include',
});

/** 缓存 CSRF token，session 变化时会重新获取 */
let cachedCsrfToken: string | null = null;

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

const csrfMiddleware: Middleware = {
  async onRequest({ request }) {
    if (SAFE_METHODS.has(request.method)) return request;

    if (!cachedCsrfToken) {
      const res = await fetch('/api/v1/auth/csrf', { credentials: 'include' });
      if (res.ok) {
        const body = (await res.json()) as { data: { token: string } };
        cachedCsrfToken = body.data.token || null;
      }
    }

    if (cachedCsrfToken) {
      request.headers.set('x-csrf-token', cachedCsrfToken);
    }
    return request;
  },
  async onResponse({ response }) {
    if (response.status === 401 || response.status === 403) {
      cachedCsrfToken = null;
    }
    return response;
  },
};

apiClient.use(csrfMiddleware);
