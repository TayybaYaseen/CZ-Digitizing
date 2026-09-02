import type { FieldError } from 'react-hook-form';

export function FormField({
  label,
  htmlFor,
  error,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: FieldError;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <label htmlFor={htmlFor} className="block text-sm font-medium text-gray-300">
        {label}
      </label>
      {children}
      {error && <p className="text-sm text-red-400">{error.message}</p>}
    </div>
  );
}

// docs/specs/2026-09-02-01-brand-visual-identity.md AC-5 — re-pointed onto the brand navy/gold
// tokens instead of the achromatic gray palette chosen before a design system existed.
export const inputClass =
  'w-full rounded-md border border-brand-silver/20 bg-brand-navy px-3 py-2 text-sm text-brand-silver focus:border-brand-gold focus:outline-none focus:ring-1 focus:ring-brand-gold/40';

export const submitButtonClass =
  'w-full rounded-md bg-brand-gold px-4 py-2 text-sm font-semibold text-brand-navy hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50';
