/**
 * Minimal authenticated fetch client.
 *
 * The main API service (src/services/api.ts) already covers most of the app,
 * but it is shared with other work streams and was not extended here. This
 * client covers the endpoints owned by the notifications, clinical notes and
 * audit trail features, with the same conventions the main service uses:
 *
 *  - the API base URL comes from VITE_API_URL and falls back to '/api';
 *  - the bearer token is read from localStorage, exactly like the main
 *    service does, so the server's CSRF check is skipped for non-GET calls;
 *  - a failed response rejects with an Error carrying the server's message.
 */

const resolveApiBaseUrl = (): string => {
  const configured = import.meta.env.VITE_API_URL || '/api';

  // The default 5600 belongs to the local mock API middleware. When it is
  // injected but not running, fall back to the relative path so the dev
  // server proxy takes over.
  if (import.meta.env.DEV && configured.includes('localhost:5600')) {
    return '/api';
  }

  return configured;
};

export const API_BASE_URL = resolveApiBaseUrl();

export interface ApiRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined | null>;
  signal?: AbortSignal;
}

export class ApiRequestError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiRequestError';
    this.status = status;
  }
}

function buildUrl(path: string, query?: ApiRequestOptions['query']): string {
  const base = API_BASE_URL.replace(/\/$/, '');
  const suffix = path.startsWith('/') ? path : `/${path}`;
  let url = `${base}${suffix}`;

  if (query) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null || value === '') continue;
      params.append(key, String(value));
    }
    const serialised = params.toString();
    if (serialised) url += `?${serialised}`;
  }

  return url;
}

/**
 * Performs an authenticated request and returns the parsed body.
 *
 * Rejects with an ApiRequestError when the server answers with a non-2xx
 * status; the message is the server's own `error` field when it has one.
 */
export async function apiRequest<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const { method = 'GET', body, query, signal } = options;

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };

  const token = localStorage.getItem('token');
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(buildUrl(path, query), {
    method,
    headers,
    credentials: 'include',
    signal,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    const message =
      (payload && typeof payload === 'object' && 'error' in payload && typeof payload.error === 'string')
        ? payload.error
        : `Request failed with status ${response.status}`;
    throw new ApiRequestError(message, response.status);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}
