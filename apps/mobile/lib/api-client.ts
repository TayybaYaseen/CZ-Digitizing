import * as SecureStore from 'expo-secure-store';
import type { ApiError, ApiResponse } from '@czd/shared-types';

// docs/specs/2026-08-29-18-mobile-app-android-ios.md (aspect A-023). Port of
// apps/web/lib/api-client.ts's exact shape (apiFetch/apiFetchWithMeta/ApiClientError/refresh-token
// dedupe) with two RN-appropriate swaps:
//  - localStorage -> expo-secure-store (session tokens are sensitive; SecureStore is the RN
//    platform-appropriate encrypted-storage equivalent).
//  - credentials:'include' (browser cookie jar) -> an explicit `x-device-id` header read from
//    SecureStore, since React Native has no cookie jar. This preserves the auth spec's new-device-
//    verification flow (NEW_DEVICE_VERIFICATION_REQUIRED), which apps/web gets "for free" via the
//    httpOnly czd_device_id cookie the API sets — apps/mobile instead persists the device id it
//    receives back from login/register and sends it explicitly on every request.
export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000';

const AUTH_KEY = 'czd.auth';
const DEVICE_ID_KEY = 'czd.device_id';

interface StoredAuth {
  user: unknown;
  accessToken: string | null;
  refreshToken: string | null;
}

async function readStoredAuth(): Promise<StoredAuth | null> {
  try {
    const raw = await SecureStore.getItemAsync(AUTH_KEY);
    return raw ? (JSON.parse(raw) as StoredAuth) : null;
  } catch {
    return null;
  }
}

async function writeAccessToken(accessToken: string): Promise<void> {
  const current = await readStoredAuth();
  if (!current) return;
  await SecureStore.setItemAsync(AUTH_KEY, JSON.stringify({ ...current, accessToken }));
}

async function clearStoredAuth(): Promise<void> {
  await SecureStore.deleteItemAsync(AUTH_KEY);
}

export async function getDeviceId(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(DEVICE_ID_KEY);
  } catch {
    return null;
  }
}

export async function setDeviceId(deviceId: string): Promise<void> {
  await SecureStore.setItemAsync(DEVICE_ID_KEY, deviceId);
}

// Access tokens are short-lived (15 min, architecture §Authentication & Security) — without this,
// every screen's API calls start failing with UNAUTHENTICATED the moment a session outlives that
// window, even though the 7-day refresh token is still good. Concurrent 401s share one in-flight
// refresh instead of each firing their own POST /api/auth/refresh-token.
let refreshInFlight: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    const stored = await readStoredAuth();
    if (!stored?.refreshToken) return null;
    try {
      const deviceId = await getDeviceId();
      const res = await fetch(`${API_URL}/api/auth/refresh-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(deviceId ? { 'x-device-id': deviceId } : {}) },
        body: JSON.stringify({ refreshToken: stored.refreshToken }),
      });
      if (!res.ok) {
        await clearStoredAuth(); // refresh token itself is expired/revoked — nothing left to retry with
        return null;
      }
      const body = (await res.json()) as ApiResponse<{ accessToken: string }>;
      await writeAccessToken(body.data.accessToken);
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

async function buildHeaders(init: RequestInit | undefined, accessToken?: string): Promise<Record<string, string>> {
  const isFormData = typeof FormData !== 'undefined' && init?.body instanceof FormData;
  const deviceId = await getDeviceId();
  const headers: Record<string, string> = {
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    ...(deviceId ? { 'x-device-id': deviceId } : {}),
    ...(init?.headers as Record<string, string> | undefined),
  };
  if (accessToken && headers.Authorization) headers.Authorization = `Bearer ${accessToken}`;
  return headers;
}

async function fetchWithAuthRetry(path: string, init: RequestInit | undefined): Promise<Response> {
  const first = await fetch(`${API_URL}${path}`, { ...init, headers: await buildHeaders(init) });

  if (first.status !== 401) return first;

  const body = await first.clone().json().catch(() => null);
  if (!isUnauthenticated(body)) return first; // a 401 for a different reason (e.g. bad credentials) — don't retry

  const newAccessToken = await refreshAccessToken();
  if (!newAccessToken) return first; // refresh failed — surface the original 401 as-is

  return fetch(`${API_URL}${path}`, { ...init, headers: await buildHeaders(init, newAccessToken) });
}

export class ApiClientError extends Error {
  constructor(public readonly error: ApiError) {
    super(error.message);
  }
}

// A 204 (or any response with no body) has nothing for res.json() to parse.
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
// `meta.total` (apiFetch discards it).
export async function apiFetchWithMeta<T>(path: string, init?: RequestInit): Promise<ApiResponse<T>> {
  const res = await fetchWithAuthRetry(path, init);
  const body = await readJsonBody(res);

  if (!res.ok) {
    throw new ApiClientError((body as { error: ApiError }).error);
  }

  return body as ApiResponse<T>;
}

export { readStoredAuth, clearStoredAuth, AUTH_KEY };
