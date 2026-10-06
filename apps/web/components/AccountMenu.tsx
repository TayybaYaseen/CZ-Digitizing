'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useLocale, type TranslationKey } from '@/lib/locale-context';
import { useSupportUnreadCount } from '@/lib/support-chat';

const MENU_LINKS: { href: string; label: TranslationKey }[] = [
  { href: '/account', label: 'nav.myAccount' },
  { href: '/account/orders', label: 'account.orders' },
  { href: '/account/credits', label: 'account.credits' },
  { href: '/account/subscription', label: 'nav.subscription' },
];

// docs/specs/2026-09-01-20-landing-page-experience.md AC-2 — "name/avatar → account menu" for a
// signed-in visitor, replacing the bare NotificationBell-only branch Header.tsx had before.
export function AccountMenu() {
  const { user, accessToken, logout } = useAuth();
  const { t } = useLocale();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  // A-025 — "Chat with Support" lives here rather than as a new header icon: the header has no spare
  // width at 1366/1440px (docs/incidents/2026-09-12-header-navigation-overflow.md, spec §8.1).
  const isCustomer = user?.role === 'customer';
  const supportUnread = useSupportUnreadCount(accessToken, isCustomer);

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
        aria-label={t('accountMenu.label')}
        className="flex items-center gap-2 rounded-md border border-brand-silver/20 px-2 py-1 text-sm text-brand-silver hover:bg-white/5"
      >
        <span className="relative flex h-6 w-6 items-center justify-center rounded-full bg-brand-gold text-xs font-semibold text-brand-navy">
          {initial}
          {supportUnread > 0 && <span aria-hidden="true" className="absolute -end-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-brand-navy bg-red-500" />}
        </span>
        <span className="hidden max-w-[8rem] truncate lg:inline">{user.displayName ?? user.email}</span>
      </button>

      {open && (
        <div role="menu" className="absolute end-0 top-full z-20 mt-1 w-48 rounded-md border border-brand-silver/20 bg-brand-navyLight py-1 shadow-lg">
          {MENU_LINKS.map((link) => (
            <Link key={link.href} href={link.href} role="menuitem" onClick={() => setOpen(false)} className="block px-3 py-2 text-sm text-brand-silver hover:bg-white/5">
              {t(link.label)}
            </Link>
          ))}
          {isCustomer && (
            <Link href="/account/support" role="menuitem" onClick={() => setOpen(false)} className="flex items-center justify-between gap-2 px-3 py-2 text-sm text-brand-silver hover:bg-white/5">
              <span>{t('supportChat.title')}</span>
              {supportUnread > 0 && (
                <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1.5 text-[11px] font-semibold text-white">
                  <span aria-hidden="true">{supportUnread > 99 ? '99+' : supportUnread}</span>
                  <span className="sr-only">{t('supportChat.unread', { count: supportUnread })}</span>
                </span>
              )}
            </Link>
          )}
          <button
            role="menuitem"
            onClick={() => {
              setOpen(false);
              logout();
              router.push('/');
            }}
            className="block w-full px-3 py-2 text-start text-sm text-brand-silver hover:bg-white/5"
          >
            {t('nav.logout')}
          </button>
        </div>
      )}
    </div>
  );
}
