'use client';

/**
 * Browser API client. Auth rides on the httpOnly session cookie, so we never
 * touch tokens or the API key here. On a 401 we transparently refresh once and
 * retry the original request.
 */

export interface ApiResult<T> {
  success: boolean;
  data?: T;
  error?: { message: string; code?: string; details?: unknown };
}

export class ApiError extends Error {
  code?: string;
  status: number;
  details?: unknown;
  constructor(message: string, status: number, code?: string, details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

const AUTH_PATHS = ['/api/auth/login', '/api/auth/register', '/api/auth/refresh'];

async function raw(path: string, init?: RequestInit): Promise<Response> {
  return fetch(path, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
    credentials: 'same-origin',
  });
}

export async function apiFetch<T = unknown>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  let res = await raw(path, init);

  if (res.status === 401 && !AUTH_PATHS.includes(path)) {
    // Try a one-shot refresh, then retry the original request.
    const refresh = await raw('/api/auth/refresh', { method: 'POST' });
    if (refresh.ok) {
      res = await raw(path, init);
    }
  }

  let body: ApiResult<T> | null = null;
  try {
    body = (await res.json()) as ApiResult<T>;
  } catch {
    // non-JSON response
  }

  if (!res.ok || !body?.success) {
    throw new ApiError(
      body?.error?.message ?? `Request failed (${res.status})`,
      res.status,
      body?.error?.code,
      body?.error?.details,
    );
  }
  return body.data as T;
}

export const api = {
  get: <T>(p: string) => apiFetch<T>(p),
  post: <T>(p: string, data?: unknown) =>
    apiFetch<T>(p, { method: 'POST', body: data ? JSON.stringify(data) : undefined }),
  patch: <T>(p: string, data?: unknown) =>
    apiFetch<T>(p, { method: 'PATCH', body: data ? JSON.stringify(data) : undefined }),
  del: <T>(p: string) => apiFetch<T>(p, { method: 'DELETE' }),
};
