import type { ApiError, ApiResponse } from '@czd/shared-types';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export class ApiClientError extends Error {
  constructor(public readonly error: ApiError) {
    super(error.message);
  }
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    // web (:3000) and api (:4000) are different origins — without this, the browser never
    // sends/stores the httpOnly czd_device_id cookie the backend's device-trust flow relies on
    // (AC-2/AC-3). The API's CORS config already allows it (credentials: true in main.ts).
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });

  const body = await res.json();

  if (!res.ok) {
    throw new ApiClientError((body as { error: ApiError }).error);
  }

  return (body as ApiResponse<T>).data;
}

// /health is wrapped in the ApiResponse<T> envelope like every other route, via
// apps/api/src/common/interceptors/response.interceptor.ts's global interceptor.
export async function checkHealth(): Promise<{ status: string; timestamp: string }> {
  return apiFetch<{ status: string; timestamp: string }>('/health');
}
