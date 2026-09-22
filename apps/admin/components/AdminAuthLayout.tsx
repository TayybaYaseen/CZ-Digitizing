import { Logo } from './Logo';

// UI-only visual correction (2026-09-12 gap analysis): the admin login/2FA/device-verification
// screens, and the "/" landing page shown before login, rendered as bare unstyled <h1>+<form>
// markup inside the app's default authenticated shell (bg-gray-100, a stray notification bar) —
// none of the navy/gold brand identity apps/web's equivalent AuthLayout already has. This mirrors
// that same split-panel pattern (navy brand panel + white card) using this app's own Logo and
// navy-800/gold-500 tokens, which the rest of apps/admin already uses (Sidebar, FormField, the
// dashboard). Reused by every admin authentication screen — same behavior/fields, visual shell only.
//
// 2026-09-22 admin-auth redesign (E1/E5): added the "ADMIN PORTAL" eyebrow + a restricted-access
// security cue to the navy panel, and a compact md:hidden header (light-variant Logo, same asset,
// no redraw) so the brand mark is still present once the navy panel itself is hidden below `md` —
// previously the phone-width view showed no logo at all. Structure/props/behavior unchanged.
export function AdminAuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-navy-900 px-4 py-10">
      <div className="mx-auto flex w-full max-w-4xl overflow-hidden rounded-card border border-white/10 shadow-cz-navy">
        <div className="relative hidden w-[300px] shrink-0 flex-col justify-between overflow-hidden bg-navy-800 p-10 md:flex">
          <div className="z-10">
            <Logo variant="dark" height={64} />
          </div>

          <div className="z-10">
            <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-gold-500">Admin Portal</div>
            <div className="mt-2 font-display text-[26px] font-bold leading-tight text-white">Manage · Track · Grow</div>
            <div className="mt-3 h-px w-10 bg-gold-500" />
            <p className="mt-4 text-[14px] leading-relaxed text-white/60">
              Operations console for orders, customers, designs, and platform settings.
            </p>
          </div>

          <div className="z-10 space-y-1.5 text-xs text-white/40">
            <p className="font-medium uppercase tracking-[0.1em] text-white/50">Restricted access · Authorized personnel only</p>
            <p>&copy; {new Date().getFullYear()} CZ Digitizing. All rights reserved.</p>
          </div>
        </div>

        <div className="flex flex-1 items-center justify-center bg-white px-6 py-10 sm:px-12 sm:py-12">
          <div className="w-full max-w-sm">
            <div className="mb-8 flex flex-col items-center gap-2 text-center md:hidden">
              <Logo variant="light" height={44} />
              <div className="text-[10.5px] font-semibold uppercase tracking-[0.22em] text-gold-600">Admin Portal</div>
            </div>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
