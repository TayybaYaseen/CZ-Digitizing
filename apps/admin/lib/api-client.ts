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
