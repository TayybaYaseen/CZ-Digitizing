import type { ApiError } from '@czd/shared-types';

// Top-of-form banner per spec §5 UI states — for errors that aren't a single field's problem.
// VALIDATION_ERROR's field-level errors[] are shown inline via FormField instead, not here.
// `onRetry` is optional and additive — every existing caller that doesn't pass it is unaffected;
// pass it only where re-running the failed action is meaningful (e.g. re-fetching a list), per
// docs/specs/2026-08-28-02-notifications-system.md §5's "failed fetch shows retry with traceId".
export function ErrorBanner({ error, onRetry }: { error: ApiError | null; onRetry?: () => void }) {
  if (!error || error.code === 'VALIDATION_ERROR') return null;

  return (
    <div className="rounded-field border border-red-200 bg-status-redBg px-4 py-3 text-sm text-status-redFg">
      <div className="flex items-center justify-between gap-3">
        <span>{error.message}</span>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="flex-shrink-0 rounded-field border border-status-redFg/30 px-2 py-1 text-xs font-medium text-status-redFg hover:bg-status-redBg/70"
          >
            Retry
          </button>
        )}
      </div>
      {error.traceId && <p className="mt-1 text-xs text-status-redFg/70">Reference: {error.traceId}</p>}
    </div>
  );
}

export function SuccessBanner({ message }: { message: string }) {
  return (
    <div className="rounded-field border border-green-200 bg-status-greenBg px-4 py-3 text-sm text-status-greenFg">
      {message}
    </div>
  );
}
