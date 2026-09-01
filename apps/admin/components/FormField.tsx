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

export const inputClass =
  'w-full rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-100 focus:border-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-400';

export const submitButtonClass =
  'w-full rounded-md bg-gray-100 px-4 py-2 text-sm font-medium text-gray-900 hover:bg-white disabled:cursor-not-allowed disabled:opacity-50';
