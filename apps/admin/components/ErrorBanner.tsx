import type { ApiError } from '@czd/shared-types';

// Top-of-form banner per spec §5 UI states — for errors that aren't a single field's problem.
// VALIDATION_ERROR's field-level errors[] are shown inline via FormField instead, not here.
export function ErrorBanner({ error }: { error: ApiError | null }) {
  if (!error || error.code === 'VALIDATION_ERROR') return null;

  return (
    <div className="rounded-field border border-red-200 bg-status-redBg px-4 py-3 text-sm text-status-redFg">
      {error.message}
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
