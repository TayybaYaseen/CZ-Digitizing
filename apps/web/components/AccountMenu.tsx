'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/lib/auth-context';

const MENU_LINKS = [
  { href: '/account', label: 'My Account' },
  { href: '/account/orders', label: 'Orders' },
  { href: '/account/credits', label: 'Credits' },
  { href: '/account/subscription', label: 'Subscription' },
];

// docs/specs/2026-09-01-20-landing-page-experience.md AC-2 — "name/avatar → account menu" for a
// signed-in visitor, replacing the bare NotificationBell-only branch Header.tsx had before.
export function AccountMenu() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  if (!user) return null;
  const initial = (user.displayName ?? user.email).charAt(0).toUpperCase();

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-2 rounded-md border border-brand-silver/20 px-2 py-1 text-sm text-brand-silver hover:bg-white/5"
      >
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-gold text-xs font-semibold text-brand-navy">{initial}</span>
        <span className="hidden max-w-[8rem] truncate lg:inline">{user.displayName ?? user.email}</span>
      </button>

      {open && (
        <div role="menu" className="absolute right-0 top-full z-20 mt-1 w-48 rounded-md border border-brand-silver/20 bg-brand-navyLight py-1 shadow-lg">
          {MENU_LINKS.map((link) => (
            <Link key={link.href} href={link.href} role="menuitem" onClick={() => setOpen(false)} className="block px-3 py-2 text-sm text-brand-silver hover:bg-white/5">
              {link.label}
            </Link>
          ))}
          <button
            role="menuitem"
            onClick={() => {
              setOpen(false);
              logout();
              router.push('/');
            }}
            className="block w-full px-3 py-2 text-left text-sm text-brand-silver hover:bg-white/5"
          >
            Log out
          </button>
        </div>
      )}
    </div>
  );
}
