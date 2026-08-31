// Mirrors docs/specs/2026-08-28-cz-digitizing-platform.md §3 API contract.
// Single source of truth shared by apps/api, apps/web, apps/admin.

export interface ApiResponse<T> {
  data: T;
  meta?: { page?: number; pageSize?: number; total?: number };
}

export interface ApiError {
  code: ApiErrorCode;
  message: string;
  errors?: { field: string; message: string }[];
  traceId: string;
}

// Global codes (master spec §3) + feature-specific codes, added here before first use.
export type ApiErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'RESOURCE_NOT_FOUND'
  | 'CONFLICT'
  | 'FILE_FORMAT_BLOCKED'
  | 'PAYMENT_NOT_CONFIRMED'
  | 'RATE_LIMITED'
  // Auth spec (docs/specs/2026-08-28-01-auth-account-security.md §3)
  | 'NEW_DEVICE_VERIFICATION_REQUIRED'
  | 'INVALID_OR_EXPIRED_CODE'
  | 'EMAIL_ALREADY_REGISTERED';
