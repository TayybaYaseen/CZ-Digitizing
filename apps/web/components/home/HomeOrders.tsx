'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { apiFetch, apiFetchWithMeta } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { useLocale } from '@/lib/locale-context';
import { OrderCard, type OrderCardDto } from '@/components/OrderCard';

const CUSTOMER_RECENT_ORDERS = 3;

// Guest checkout — "Your Orders" on the home page.
//   - Signed-in customer: their own recent orders (GET /api/orders/user/history), the account page
//     keeps the full history.
//   - Not signed in: the orders THIS browser placed as a guest (GET /api/guest-orders). The browser's
//     httpOnly czd_guest_orders cookie is what the API matches — this component never sees or sends
//     an order id, email or token of its own, so it can only ever show this browser's orders.
//   - Never bought (or anything fails to load): renders nothing, so the home page is unchanged for a
//     first-time visitor and a hiccup here can't break it.
// The two sources are never mixed: a signed-in visitor sees only their account's orders.
export function HomeOrders() {
  const { user, accessToken, isReady } = useAuth();
  const { t } = useLocale();
  const [orders, setOrders] = useState<OrderCardDto[] | null>(null);
  const signedIn = Boolean(user);
  const isCustomer = user?.role === 'customer';

  useEffect(() => {
    if (!isReady) return;
    let cancelled = false;
    setOrders(null);
    const load: Promise<OrderCardDto[]> = signedIn
      ? isCustomer && accessToken
        ? apiFetchWithMeta<OrderCardDto[]>(`/api/orders/user/history?page=1&pageSize=${CUSTOMER_RECENT_ORDERS}`, { headers: { Authorization: `Bearer ${accessToken}` } }).then((r) => r.data)
        : Promise.resolve([])
      : apiFetch<OrderCardDto[]>('/api/guest-orders');
    load
      .then((rows) => !cancelled && setOrders(rows ?? []))
      .catch(() => !cancelled && setOrders([]));
    return () => {
      cancelled = true;
    };
  }, [isReady, signedIn, isCustomer, accessToken]);

  if (!orders || orders.length === 0) return null;

  return (
    <section className="space-y-4" aria-labelledby="home-orders-title" data-testid="home-orders">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="home-orders-title" className="font-display text-xl font-bold text-brand-navy">
          {t('homeOrders.title')}
        </h2>
        {signedIn && (
          <Link href="/account/orders" className="text-sm text-brand-navy underline">
            {t('homeOrders.viewAll')}
          </Link>
        )}
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {orders.map((order) => (
          <OrderCard key={order.id} order={order} guest={!signedIn} />
        ))}
      </div>
      {!signedIn && <p className="text-xs text-gray-500">{t('homeOrders.savedOnBrowser')}</p>}
    </section>
  );
}
