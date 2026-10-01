'use client';

import Link from 'next/link';
import { useLocale } from '@/lib/locale-context';

// Guest checkout — shown when a visitor who isn't signed in opens an order this browser can't see
// (another browser's order, cookies cleared, a different device, or a mistyped link). It never says
// whether the order exists, and offers only the secure ways back: signing in with the checkout email
// (which proves ownership with an emailed code) or contacting support.
export function GuestOrderUnavailable() {
  const { t } = useLocale();
  return (
    <div className="mx-auto max-w-lg space-y-3 rounded-card border border-gray-200 bg-white p-6 text-sm shadow-cz-sm" data-testid="guest-order-unavailable">
      <h1 className="font-display text-xl font-bold text-brand-navy">{t('homeOrders.orderUnavailable')}</h1>
      <p className="text-gray-700">{t('homeOrders.noGuestOrders')}</p>
      <p className="text-gray-600">{t('homeOrders.recoveryHelp')}</p>
      <div className="flex flex-wrap gap-2 pt-1">
        <Link href="/login" className="rounded-md bg-brand-gold px-3 py-1.5 font-semibold text-brand-navy">
          {t('nav.login')}
        </Link>
        <Link href="/contact" className="rounded-md border border-gray-300 px-3 py-1.5 text-brand-navy hover:bg-gray-50">
          {t('homeOrders.support')}
        </Link>
      </div>
    </div>
  );
}
