'use client';

import { usePathname } from 'next/navigation';
import { NotificationBell } from './NotificationBell';
import { Sidebar } from './Sidebar';

// UI-only visual correction (2026-09-12 gap analysis): every route — including the pre-login "/"
// and the login/2FA/device-verification screens — used to render inside the same authenticated
// shell (Sidebar + a top notification bar), which left those pages sitting under a stray empty
// white bar with nothing in it (Sidebar/NotificationBell both already return null when logged out)
// on top of unstyled content. Routes in the auth family now render full-bleed instead, so
// AdminAuthLayout's own navy/white split panel is the only chrome on those pages. No route,
// redirect, or guard logic changes — Sidebar/NotificationBell keep exactly the same auth checks.
const AUTH_ROUTE_PREFIXES = ['/login'];

function isAuthRoute(pathname: string | null): boolean {
  if (!pathname) return false;
  if (pathname === '/') return true;
  return AUTH_ROUTE_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  if (isAuthRoute(pathname)) {
    return <main className="h-screen overflow-y-auto bg-navy-900">{children}</main>;
  }

  return (
    <div className="flex h-screen">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center justify-end gap-3 border-b border-gray-200 bg-white px-6 py-3">
          <NotificationBell />
        </div>
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
