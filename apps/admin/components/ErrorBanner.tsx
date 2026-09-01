import type { ApiError } from '@czd/shared-types';

// Top-of-form banner per spec §5 UI states — for errors that aren't a single field's problem.
// VALIDATION_ERROR's field-level errors[] are shown inline via FormField instead, not here.
export function ErrorBanner({ error }: { error: ApiError | null }) {
  if (!error || error.code === 'VALIDATION_ERROR') return null;

  return (
    <div className="rounded-md border border-red-900 bg-red-950 px-4 py-3 text-sm text-red-300">
      {error.message}
    </div>
  );
}

export function SuccessBanner({ message }: { message: string }) {
  return (
    <div className="rounded-md border border-green-900 bg-green-950 px-4 py-3 text-sm text-green-300">
      {message}
    </div>
  );
}
