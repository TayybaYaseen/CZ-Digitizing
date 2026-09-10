import { ApiClientError } from './api-client';

// Every auth screen was catching ApiClientError and showing only `error.message`, which for a
// VALIDATION_ERROR (apps/api/src/common/filters/all-exceptions.filter.ts) is always the generic
// literal "Validation failed" — the actual per-field reason (e.g. "password must be at least 8
// characters") lives in `error.errors` and was being dropped entirely. apps/web surfaces these via
// react-hook-form's setError per field (apps/web/app/register/page.tsx); this app has no form
// library, so the equivalent here is folding every field message into one readable line.
export function getErrorMessage(e: unknown, fallback: string): string {
  if (e instanceof ApiClientError) {
    if (e.error.code === 'VALIDATION_ERROR' && e.error.errors?.length) {
      return e.error.errors.map((fieldError) => fieldError.message).join('\n');
    }
    return e.error.message;
  }
  return fallback;
}
