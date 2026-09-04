import type { ApiError, ApiResponse } from '@czd/shared-types';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

// Mirrors auth-context.tsx's STORAGE_KEY/AuthState shape exactly — this module can't use the
// useAuth() hook (it's not a component), so it reads/writes the same localStorage entry directly.
const STORAGE_KEY = 'czd.admin.auth';

interface StoredAuth {
  user: unknown;
  accessToken: string | null;
  refreshToken: string | null;
}

function readStoredAuth(): StoredAuth | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as StoredAuth) : null;
  } catch {
    return null;
  }
}

function writeAccessToken(accessToken: string) {
  const current = readStoredAuth();
  if (!current) return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...current, accessToken }));
}

function clearStoredAuth() {
  window.localStorage.removeItem(STORAGE_KEY);
}

// Access tokens are short-lived (15 min, architecture §Authentication & Security) — without this,
// every page's API calls start failing with UNAUTHENTICATED "Invalid or expired token" the moment
// a session outlives that window, even though the 7-day refresh token is still good. Concurrent
// 401s share one in-flight refresh instead of each firing their own POST /api/auth/refresh-token.
let refreshInFlight: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    const stored = readStoredAuth();
    if (!stored?.refreshToken) return null;
    try {
      const res = await fetch(`${API_URL}/api/auth/refresh-token`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: stored.refreshToken }),
      });
      if (!res.ok) {
        clearStoredAuth(); // refresh token itself is expired/revoked — nothing left to retry with
        return null;
      }
      const body = (await res.json()) as ApiResponse<{ accessToken: string }>;
      writeAccessToken(body.data.accessToken);
      return body.data.accessToken;
    } catch {
      return null;
    }
  })();

  try {
    return await refreshInFlight;
  } finally {
    refreshInFlight = null;
  }
}

function isUnauthenticated(body: unknown): boolean {
  return typeof body === 'object' && body !== null && (body as { error?: { code?: string } }).error?.code === 'UNAUTHENTICATED';
}

// Only swaps the Authorization header if the caller set one in the first place — a call with no
// bearer token (a public route) stays that way on retry too. A FormData body (file uploads, A-007)
// must NOT get an explicit Content-Type — the browser sets multipart/form-data with the correct
// boundary itself; forcing application/json here would silently break every multipart upload.
function buildHeaders(init: RequestInit | undefined, accessToken?: string): Record<string, string> {
  const isFormData = typeof FormData !== 'undefined' && init?.body instanceof FormData;
  const headers: Record<string, string> = { ...(isFormData ? {} : { 'Content-Type': 'application/json' }), ...(init?.headers as Record<string, string> | undefined) };
  if (accessToken && headers.Authorization) headers.Authorization = `Bearer ${accessToken}`;
  return headers;
}

async function fetchWithAuthRetry(path: string, init: RequestInit | undefined): Promise<Response> {
  const first = await fetch(`${API_URL}${path}`, {
    ...init,
    // admin (:3002) and api (:4000) are different origins — without this, the browser never
    // sends/stores the httpOnly czd_device_id cookie the backend's device-trust flow relies on
    // (AC-2/AC-3, and admin login's device-id-scoped pending-2FA token). The API's CORS config
    // already allows it (credentials: true in main.ts).
    credentials: 'include',
    headers: buildHeaders(init),
  });

  if (first.status !== 401) return first;

  const body = await first.clone().json().catch(() => null);
  if (!isUnauthenticated(body)) return first; // a 401 for a different reason (e.g. bad credentials) — don't retry

  const newAccessToken = await refreshAccessToken();
  if (!newAccessToken) return first; // refresh failed — surface the original 401 as-is

  return fetch(`${API_URL}${path}`, {
    ...init,
    credentials: 'include',
    headers: buildHeaders(init, newAccessToken),
  });
}

export class ApiClientError extends Error {
  constructor(public readonly error: ApiError) {
    super(error.message);
  }
}

// A 204 (or any response with no body — logout, this file's own DELETE routes, per
// ResponseInterceptor's own doc comment: "204 routes like logout return undefined") has nothing
// for res.json() to parse; calling it anyway throws "Unexpected end of JSON input" and turns a
// successful delete into a thrown error at the call site, even though the request itself
// succeeded. Every apiFetch caller across the app that awaits a DELETE (bundles, categories,
// designs, freelancer accounts, notifications, and this file's own subscription-plan/credit-
// package delete buttons) was silently subject to this — the request always reached the server
// and always succeeded, but the client-side promise always rejected afterward.
async function readJsonBody(res: Response): Promise<unknown> {
  if (res.status === 204) return undefined;
  const text = await res.text();
  return text ? JSON.parse(text) : undefined;
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetchWithAuthRetry(path, init);
  const body = await readJsonBody(res);

  if (!res.ok) {
    throw new ApiClientError((body as { error: ApiError }).error);
  }

  return (body as ApiResponse<T> | undefined)?.data as T;
}

// Same as apiFetch, but returns the full envelope — needed by paginated list views that read
// `meta.total` (apiFetch discards it, which is fine for every non-paginated caller).
export async function apiFetchWithMeta<T>(path: string, init?: RequestInit): Promise<ApiResponse<T>> {
  const res = await fetchWithAuthRetry(path, init);
  const body = await readJsonBody(res);

  if (!res.ok) {
    throw new ApiClientError((body as { error: ApiError }).error);
  }

  return body as ApiResponse<T>;
}

// /health is wrapped in the ApiResponse<T> envelope like every other route, via
// apps/api/src/common/interceptors/response.interceptor.ts's global interceptor.
export async function checkHealth(): Promise<{ status: string; timestamp: string }> {
  return apiFetch<{ status: string; timestamp: string }>('/health');
}
