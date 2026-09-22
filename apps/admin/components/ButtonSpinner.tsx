// Small loading indicator for the admin auth screens' submit buttons (E3 "loading appearance").
// Purely presentational — callers still control isSubmitting/disabled themselves; this only
// changes what renders inside the button while that's true, not the submit/loading logic itself.
export function ButtonSpinner({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center justify-center gap-2">
      <svg className="h-4 w-4 animate-spin motion-reduce:animate-none" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.5" className="opacity-25" />
        <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
      {label}
    </span>
  );
}
