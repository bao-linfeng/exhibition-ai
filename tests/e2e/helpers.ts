import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

export const API_BASE = process.env.API_BASE_URL ?? 'http://localhost:3000';

export interface E2ESession {
  cookie: string;
  userId: string;
  runId: string;
}

interface ApiEnvelope<T> {
  data: T;
}

export async function login(email: string, password: string): Promise<string> {
  const response = await fetch(`${API_BASE}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  assert.equal(response.status, 200, `Login failed for ${email}`);
  const cookie = response.headers.get('set-cookie') ?? '';
  assert.notEqual(cookie, '', 'Login response did not set a session cookie');
  return cookie.split(';', 1)[0] ?? '';
}

export async function authedFetch(
  path: string,
  cookie: string,
  init?: RequestInit,
): Promise<Response> {
  return fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      Cookie: cookie,
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });
}

export async function json<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

export async function jsonData<T>(response: Response): Promise<T> {
  return (await json<ApiEnvelope<T>>(response)).data;
}

export async function requireE2E(
  _context: unknown,
  options: { role?: 'designer' | 'viewer' | 'admin' } = {},
): Promise<E2ESession | null> {
  if (process.env.SKIP_E2E === '1') {
    return null;
  }

  try {
    const health = await fetch(`${API_BASE}/api/health`, {
      signal: AbortSignal.timeout(2_000),
    });
    if (!health.ok)
      throw new Error(`health endpoint returned ${health.status}`);
  } catch (error) {
    return null;
  }

  const role = options.role ?? 'designer';
  const email = process.env[`E2E_${role.toUpperCase()}_EMAIL`];
  const password = process.env[`E2E_${role.toUpperCase()}_PASSWORD`];
  if (!email || !password) {
    return null;
  }

  const cookie = await login(email, password);
  const user = await jsonData<{ id: string }>(
    await authedFetch('/api/v1/auth/me', cookie),
  );
  return { cookie, userId: user.id, runId: randomUUID() };
}

export function requiredFixture(
  _context: unknown,
  name: string,
): string | null {
  const value = process.env[name];
  return value ?? null;
}

export async function expectStatus(
  response: Response,
  expected: number,
): Promise<void> {
  const body = await response.text();
  assert.equal(response.status, expected, body);
}

export async function waitForTask(
  taskId: string,
  cookie: string,
  allowedStatuses: readonly string[],
): Promise<{ status: string; outputs: Array<{ state: string }> }> {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    const response = await authedFetch(`/api/v1/tasks/${taskId}`, cookie);
    if (response.ok) {
      const task = await jsonData<{
        status: string;
        outputs: Array<{ state: string }>;
      }>(response);
      if (allowedStatuses.includes(task.status)) return task;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Task ${taskId} did not reach ${allowedStatuses.join(', ')}`);
}
