import type { ApiError } from '@czd/shared-types';

// Top-of-form banner per spec §5 UI states — for errors that aren't a single field's problem
// (INVALID_OR_EXPIRED_CODE, RATE_LIMITED, UNAUTHENTICATED, EMAIL_ALREADY_REGISTERED, etc.).
// VALIDATION_ERROR's field-level errors[] are shown inline via FormField instead, not here.
// `onRetry` is optional and additive — every existing caller that doesn't pass it is unaffected;
// pass it only where re-running the failed action is meaningful (e.g. re-fetching a list), per
// docs/specs/2026-08-28-02-notifications-system.md §5's "failed fetch shows retry with traceId".
export function ErrorBanner({ error, onRetry }: { error: ApiError | null; onRetry?: () => void }) {
  if (!error || error.code === 'VALIDATION_ERROR') return null;

  return (
    <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
      <div className="flex items-center justify-between gap-3">
        <span>{error.message}</span>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="flex-shrink-0 rounded border border-red-300 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-100"
          >
            Retry
          </button>
        )}
      </div>
      {error.traceId && <p className="mt-1 text-xs text-red-400">Reference: {error.traceId}</p>}
    </div>
  );
}

export function SuccessBanner({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
      {message}
    </div>
  );
}
