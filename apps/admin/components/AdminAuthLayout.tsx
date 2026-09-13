import { Logo } from './Logo';

// UI-only visual correction (2026-09-12 gap analysis): the admin login/2FA/device-verification
// screens, and the "/" landing page shown before login, rendered as bare unstyled <h1>+<form>
// markup inside the app's default authenticated shell (bg-gray-100, a stray notification bar) —
// none of the navy/gold brand identity apps/web's equivalent AuthLayout already has. This mirrors
// that same split-panel pattern (navy brand panel + white card) using this app's own Logo and
// navy-800/gold-500 tokens, which the rest of apps/admin already uses (Sidebar, FormField, the
// dashboard). Reused by every admin authentication screen — same behavior/fields, visual shell only.
export function AdminAuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-navy-900 px-4 py-10">
      <div className="mx-auto flex w-full max-w-4xl overflow-hidden rounded-card border border-white/10 shadow-cz-navy">
        <div className="relative hidden w-[300px] shrink-0 flex-col justify-between overflow-hidden bg-navy-800 p-10 md:flex">
          <div className="z-10">
            <Logo variant="dark" height={64} />
          </div>

          <div className="z-10">
            <div className="font-display text-[26px] font-bold leading-tight text-white">Manage · Track · Grow</div>
            <div className="mt-3 h-px w-10 bg-gold-500" />
            <p className="mt-4 text-[14px] leading-relaxed text-white/60">
              Operations console for orders, customers, designs, and platform settings.
            </p>
          </div>

          <div className="z-10 text-xs text-white/40">&copy; {new Date().getFullYear()} CZ Digitizing. All rights reserved.</div>
        </div>

        <div className="flex flex-1 items-center justify-center bg-white px-8 py-12 sm:px-12">
          <div className="w-full max-w-sm">{children}</div>
        </div>
      </div>
    </div>
  );
}
