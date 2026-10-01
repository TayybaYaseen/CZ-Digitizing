'use client';

import Link from 'next/link';
import { formatPkr } from '@/lib/format';
import { useLocale } from '@/lib/locale-context';

// Mirrors apps/api/src/orders/dto/order.dto.ts OrderSummaryDto — returned both by
// GET /api/orders/user/history (signed-in customer) and GET /api/guest-orders (guest browser).
export interface OrderCardDto {
  id: string;
  status: string;
  paymentStatus: string;
  totalPkr: number;
  amountOutstandingPkr: number;
  // The backend's own file-access decision (100% paid + admin-confirmed, no refund). Displayed only —
  // the download routes re-check it on every request.
  filesUnlocked: boolean;
  itemCount: number;
  items: { name: string; sizeLabel: string | null; quantity: number }[];
  createdAt: string;
}

const MAX_ITEMS_SHOWN = 3;

// Guest checkout — the home-page order card, for a signed-in customer's recent orders and a guest
// browser's own orders alike. Same card treatment as the rest of the site (rounded-card, brand
// navy/gold). Holds no payment details beyond amounts: no bank data, receipt files or card numbers.
export function OrderCard({ order, guest }: { order: OrderCardDto; guest: boolean }) {
  const { t, tOr, formatDate } = useLocale();
  const awaitingPayment = order.status === 'payment_pending' && order.amountOutstandingPkr > 0;
  const shown = order.items.slice(0, MAX_ITEMS_SHOWN);
  const hidden = order.items.length - shown.length;

  return (
    <article className="flex flex-col rounded-card border border-gray-200 bg-white p-5 shadow-cz-sm" data-testid="order-card">
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="font-display text-base font-semibold text-brand-navy">{t('orders.orderId', { id: order.id })}</h3>
          <p className="text-xs text-gray-500">
            {t('homeOrders.orderDate')}: {formatDate(order.createdAt)}
          </p>
        </div>
        {guest && <span className="rounded-full bg-brand-navy/5 px-2.5 py-0.5 text-xs font-medium text-brand-navy">{t('homeOrders.guestOrder')}</span>}
      </header>

      <ul className="mt-3 space-y-1 text-sm text-gray-700">
        {shown.map((item, i) => (
          <li key={i} className="flex justify-between gap-3">
            <span className="min-w-0 truncate">
              {item.name}
              {item.sizeLabel ? ` (${item.sizeLabel})` : ''}
            </span>
            <span className="shrink-0 text-gray-500">{t('homeOrders.quantity', { count: item.quantity })}</span>
          </li>
        ))}
        {hidden > 0 && <li className="text-xs text-gray-500">{t('homeOrders.moreItems', { count: hidden })}</li>}
      </ul>

      <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 border-t border-gray-100 pt-3 text-sm">
        <dt className="text-gray-500">{t('homeOrders.orderStatus')}</dt>
        <dd className="text-end font-medium text-gray-800">{tOr(`orderStatus.${order.status}`, order.status)}</dd>
        <dt className="text-gray-500">{t('homeOrders.paymentStatus')}</dt>
        <dd className="text-end font-medium text-gray-800">{tOr(`paymentStatus.${order.paymentStatus}`, order.paymentStatus)}</dd>
        <dt className="text-gray-500">{t('cart.total')}</dt>
        <dd className="text-end font-semibold text-brand-navy">
          <span dir="ltr">{formatPkr(order.totalPkr)}</span>
        </dd>
      </dl>

      {order.filesUnlocked && <p className="mt-3 rounded bg-emerald-50 px-3 py-2 text-xs text-emerald-800">{t('homeOrders.paymentSuccessful')}</p>}
      {awaitingPayment && (
        <p className="mt-3 rounded bg-amber-50 px-3 py-2 text-xs text-amber-800">{t('homeOrders.outstanding', { amount: formatPkr(order.amountOutstandingPkr) })}</p>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
        {order.filesUnlocked ? (
          <Link href={`/order-confirmation/${order.id}`} className="rounded-md bg-brand-gold px-3 py-1.5 font-semibold text-brand-navy">
            {t('homeOrders.downloadFiles')}
          </Link>
        ) : awaitingPayment ? (
          <Link href={`/checkout/bank-transfer/${order.id}`} className="rounded-md bg-brand-gold px-3 py-1.5 font-semibold text-brand-navy">
            {t('homeOrders.payNow')}
          </Link>
        ) : null}
        <Link href={`/order-confirmation/${order.id}`} className="rounded-md border border-gray-300 px-3 py-1.5 text-brand-navy hover:bg-gray-50">
          {t('homeOrders.viewOrder')}
        </Link>
        <Link href="/contact" className="ms-auto text-xs text-brand-navy underline">
          {t('homeOrders.support')}
        </Link>
      </div>
    </article>
  );
}
