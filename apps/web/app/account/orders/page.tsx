'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { ApiError } from '@czd/shared-types';
import { ApiClientError, apiFetch, apiFetchWithMeta } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { useLocale } from '@/lib/locale-context';
import { ErrorBanner } from '@/components/ErrorBanner';
import { OrderCard, type OrderCardDto } from '@/components/OrderCard';
import { clientError } from '@/i18n/api-errors';

// "Your Orders" — the one canonical customer orders page, linked directly from the header nav.
//   - Signed-in customer: their own order history, docs/specs/2026-08-28-08-orders-payment-processing.md
//     §3/§5 (AC-7) — GET /api/orders/user/history (the API scopes it to the token's user).
//   - Not signed in: the orders THIS browser placed as a guest (GET /api/guest-orders). The browser's
//     httpOnly czd_guest_orders cookie is what the API matches — this page never sees or sends an
//     order id, email or token of its own, so it can only ever show this browser's orders. No login
//     is required to view a completed guest order.
// The two sources are never mixed: a signed-in visitor sees only their account's orders.
export default function YourOrdersPage() {
  const { user, accessToken, isReady } = useAuth();
  const { t } = useLocale();
  const [orders, setOrders] = useState<OrderCardDto[] | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const signedIn = Boolean(user);

  useEffect(() => {
    if (!isReady || (signedIn && !accessToken)) return;
    let cancelled = false;
    setOrders(null);
    setError(null);
    const load: Promise<OrderCardDto[]> = signedIn
      ? apiFetchWithMeta<OrderCardDto[]>('/api/orders/user/history?page=1&pageSize=50', { headers: { Authorization: `Bearer ${accessToken}` } }).then((r) => r.data)
      : apiFetch<OrderCardDto[]>('/api/guest-orders');
    load
      .then((rows) => !cancelled && setOrders(rows ?? []))
      .catch((err) => {
        if (cancelled) return;
        setOrders([]);
        setError(err instanceof ApiClientError ? err.error : clientError('errors.loadOrdersFailed'));
      });
    return () => {
      cancelled = true;
    };
  }, [isReady, signedIn, accessToken]);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t('nav.yourOrders')}</h1>
        <p className="mt-1 text-sm text-gray-600">{signedIn ? t('orders.historySubtitle') : t('homeOrders.savedOnBrowser')}</p>
      </div>

      <ErrorBanner error={error} />

      {orders === null ? (
        <p className="text-center text-sm text-gray-500">{t('common.loading')}</p>
      ) : orders.length === 0 ? (
        !error && (
          <div className="rounded-md border border-gray-200 px-4 py-6 text-center text-sm text-gray-500">
            <p>{signedIn ? t('orders.noOrders') : t('homeOrders.noGuestOrders')}</p>
            <div className="mt-2 flex flex-wrap justify-center gap-4">
              <Link href="/designs" className="text-brand-navy underline">
                {t('orders.browseCatalog')}
              </Link>
              {!signedIn && (
                <Link href="/login" className="text-brand-navy underline">
                  {t('nav.login')}
                </Link>
              )}
            </div>
          </div>
        )
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {orders.map((order) => (
            <OrderCard key={order.id} order={order} guest={!signedIn}>
              {signedIn && (order.status === 'completed' || order.status === 'processing' || order.status === 'ready') && (
                <div className="mt-3 border-t border-gray-100 pt-2">
                  {order.status === 'completed' && <ReviewButton orderId={order.id} accessToken={accessToken} />}
                  <FileFormatRequestButton orderId={order.id} accessToken={accessToken} />
                </div>
              )}
            </OrderCard>
          ))}
        </div>
      )}
    </div>
  );
}

// docs/specs/2026-08-28-12-custom-design-requests.md AC-6 (aspect A-017a) — "Need Another File
// Format?" on an already-purchased order.
function FileFormatRequestButton({ orderId, accessToken }: { orderId: string; accessToken: string | null }) {
  const { t } = useLocale();
  const [open, setOpen] = useState(false);
  const [requestedFormat, setRequestedFormat] = useState('');
  const [notes, setNotes] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);

  if (submitted) return <p className="mt-1 text-xs text-emerald-600">{t('orders.formatRequestSent')}</p>;
  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="mt-1 block text-xs text-brand-navy underline">
        {t('orders.needAnotherFormat')}
      </button>
    );
  }

  async function submit() {
    if (!accessToken || !requestedFormat.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/api/orders/${orderId}/file-format-request`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ requestedFormat, notes: notes || undefined }),
      });
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.error : clientError('errors.submitRequestFailed'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-2 w-56 space-y-2 rounded-md border border-gray-200 bg-white p-3 text-start">
      <ErrorBanner error={error} />
      <input
        value={requestedFormat}
        onChange={(e) => setRequestedFormat(e.target.value)}
        placeholder={t('orders.formatNeeded')}
        aria-label={t('orders.formatNeeded')}
        className="w-full rounded border border-gray-300 px-2 py-1 text-xs"
      />
      <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t('orders.notesOptional')} aria-label={t('orders.notesOptional')} className="w-full rounded border border-gray-300 px-2 py-1 text-xs" rows={2} />
      <button disabled={busy || !requestedFormat.trim()} onClick={submit} className="w-full rounded bg-gold-500 px-2 py-1 text-xs font-semibold text-navy-800">
        {t('common.submit')}
      </button>
    </div>
  );
}

// AC-7 — customer submits a review tied to this completed order; stored pending Admin moderation.
function ReviewButton({ orderId, accessToken }: { orderId: string; accessToken: string | null }) {
  const { t } = useLocale();
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(5);
  const [feedback, setFeedback] = useState('');
  const [serviceUsed, setServiceUsed] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);

  if (submitted) return <p className="mt-1 text-xs text-emerald-600">{t('orders.reviewSubmitted')}</p>;
  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="mt-1 block text-xs text-brand-navy underline">
        {t('orders.leaveReview')}
      </button>
    );
  }

  async function submit() {
    if (!accessToken || !feedback.trim() || !serviceUsed.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await apiFetch('/api/testimonials/submit', {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ orderId, rating, feedback, serviceUsed }),
      });
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.error : clientError('errors.submitReviewFailed'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-2 w-56 space-y-2 rounded-md border border-gray-200 bg-white p-3 text-start">
      <ErrorBanner error={error} />
      <select value={rating} onChange={(e) => setRating(Number(e.target.value))} aria-label={t('orders.rating')} className="w-full rounded border border-gray-300 px-2 py-1 text-xs">
        {[5, 4, 3, 2, 1].map((r) => (
          <option key={r} value={r}>
            {'★'.repeat(r)} ({r})
          </option>
        ))}
      </select>
      <input
        value={serviceUsed}
        onChange={(e) => setServiceUsed(e.target.value)}
        placeholder={t('orders.serviceUsed')}
        aria-label={t('orders.serviceUsed')}
        className="w-full rounded border border-gray-300 px-2 py-1 text-xs"
      />
      <textarea
        value={feedback}
        onChange={(e) => setFeedback(e.target.value)}
        placeholder={t('orders.yourFeedback')}
        aria-label={t('orders.yourFeedback')}
        className="w-full rounded border border-gray-300 px-2 py-1 text-xs"
        rows={3}
      />
      <button disabled={busy} onClick={submit} className="w-full rounded bg-gold-500 px-2 py-1 text-xs font-semibold text-navy-800">
        {t('common.submit')}
      </button>
    </div>
  );
}
