// Field/button classes scoped to the admin authentication screens (login, 2FA, device
// verification, the pre-login landing page) — 2026-09-22 admin-auth redesign (E2/E3).
//
// Deliberately NOT a change to components/FormField.tsx's own inputClass/submitButtonClass:
// those two are shared by ~30 unrelated admin screens (settings, quotes, designs, ...) that were
// out of scope for this redesign. This file exists so the auth screens can move onto the design
// system's documented 40px field height + 8px radius + 3px gold focus ring without touching
// anything else. Visual-only — no validation, submit, or routing behavior lives here.
export const authInputClass =
  'h-10 w-full rounded-field border border-gray-300 bg-white px-3.5 text-sm text-gray-800 transition-colors duration-150 placeholder:text-gray-400 hover:border-gray-400 focus:border-gold-500 focus:outline-none focus:ring-[3px] focus:ring-gold-500/35 disabled:cursor-not-allowed disabled:border-gray-200 disabled:bg-gray-100 disabled:text-gray-400';

// Same field, red-tinted — call sites opt in per-field (e.g. `errors.email ? authInputErrorClass :
// authInputClass`) so a validation error also shows on the field border, not just the message
// FormField already renders below it.
export const authInputErrorClass =
  'h-10 w-full rounded-field border border-red-300 bg-white px-3.5 text-sm text-gray-800 transition-colors duration-150 placeholder:text-gray-400 focus:border-red-400 focus:outline-none focus:ring-[3px] focus:ring-red-400/35';

// A numeric-code field (2FA / device-verification) — same box as authInputClass, centered and
// letter-spaced for legibility.
export const authCodeInputClass = `${authInputClass} text-center text-lg font-semibold tracking-[0.4em]`;
export const authCodeInputErrorClass = `${authInputErrorClass} text-center text-lg font-semibold tracking-[0.4em]`;

export const authSubmitButtonClass =
  'h-10 w-full rounded-field bg-gold-500 px-4 text-[14.5px] font-semibold text-navy-800 transition-all duration-150 hover:bg-gold-400 hover:shadow-cz-gold active:translate-y-px active:bg-gold-600 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-gold-500/35 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-500 disabled:shadow-none disabled:active:translate-y-0';
