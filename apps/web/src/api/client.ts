import createClient from 'openapi-fetch';
import type { paths } from '@exhibition/api-client';

export const apiClient = createClient<paths>({
  credentials: 'include',
});
