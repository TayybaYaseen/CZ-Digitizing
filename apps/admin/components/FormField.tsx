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
      <label htmlFor={htmlFor} className="block text-sm font-medium text-gray-600">
        {label}
      </label>
      {children}
      {error && <p className="text-sm text-status-redFg">{error.message}</p>}
    </div>
  );
}

// docs/CZ Digitizing Admin Panel.html's decoded field/button styling — light-surface admin panel
// (the design's Card/Field components sit on white, not navy — see components/ui/Card.tsx),
// superseding the interim dark-on-navy treatment used before this reference existed.
//
// Shared by ~30 admin screens beyond the auth flow (settings, quotes, designs, ...) — the
// 2026-09-22 admin-auth redesign deliberately does NOT touch these two exports, to keep that
// change scoped to the 4 login/2FA/device-verification/landing screens; see
// components/admin-auth-styles.ts for that screen family's own (separate) field/button classes.
export const inputClass =
  'w-full rounded-field border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 focus:border-gold-500 focus:outline-none focus:ring-1 focus:ring-gold-500/40';

export const submitButtonClass =
  'w-full rounded-field bg-gold-500 px-4 py-2 text-sm font-semibold text-navy-800 hover:brightness-105 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-500';
