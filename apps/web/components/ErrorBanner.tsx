import type { ApiError } from '@czd/shared-types';

// Top-of-form banner per spec §5 UI states — for errors that aren't a single field's problem
// (INVALID_OR_EXPIRED_CODE, RATE_LIMITED, UNAUTHENTICATED, EMAIL_ALREADY_REGISTERED, etc.).
// VALIDATION_ERROR's field-level errors[] are shown inline via FormField instead, not here.
export function ErrorBanner({ error }: { error: ApiError | null }) {
  if (!error || error.code === 'VALIDATION_ERROR') return null;

  return (
    <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
      {error.message}
    </div>
  );
}

export function SuccessBanner({ message }: { message: string }) {
  return (
    <div className="rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
      {message}
    </div>
  );
}
