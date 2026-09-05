'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { ApiError } from '@czd/shared-types';
import { ApiClientError, apiFetch, apiFetchWithMeta } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { ErrorBanner } from '@/components/ErrorBanner';

interface OrderSummaryDto {
  id: string;
  status: string;
  paymentStatus: string;
  paymentMethod: string;
  totalPkr: number;
  itemCount: number;
  createdAt: string;
}

// docs/specs/2026-08-28-08-orders-payment-processing.md §3/§5 (AC-7) — GET /api/orders/user/history.
export default function OrderHistoryPage() {
  const router = useRouter();
  const { user, accessToken, isReady } = useAuth();
  const [orders, setOrders] = useState<OrderSummaryDto[] | null>(null);
  const [error, setError] = useState<ApiError | null>(null);

  useEffect(() => {
    if (isReady && !user) router.replace('/login');
  }, [isReady, user, router]);

  useEffect(() => {
    if (!user || !accessToken) return;
    apiFetchWithMeta<OrderSummaryDto[]>('/api/orders/user/history?page=1&pageSize=50', { headers: { Authorization: `Bearer ${accessToken}` } })
      .then((res) => setOrders(res.data))
      .catch((err) => setError(err instanceof ApiClientError ? err.error : { code: 'INTERNAL_ERROR', message: 'Could not load orders.', traceId: '' }));
  }, [user, accessToken]);

  if (!isReady || !user) return null;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Order History</h1>
        <p className="mt-1 text-sm text-gray-600">Every past and future purchase, in one place.</p>
      </div>

      <ErrorBanner error={error} />

      {orders === null ? (
        <p className="text-center text-sm text-gray-500">Loading…</p>
      ) : orders.length === 0 ? (
        <div className="rounded-md border border-gray-200 px-4 py-6 text-center text-sm text-gray-500">
          <p>No orders yet.</p>
          <Link href="/designs" className="mt-2 inline-block text-brand-navy underline">
            Browse the catalog
          </Link>
        </div>
      ) : (
        <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white">
          {orders.map((order) => (
            <li key={order.id} className="flex items-center justify-between px-4 py-3 text-sm">
              <div>
                <p className="font-semibold text-brand-navy">Order #{order.id}</p>
                <p className="text-gray-500">
                  {order.itemCount} item{order.itemCount === 1 ? '' : 's'} · {new Date(order.createdAt).toLocaleDateString()}
                </p>
              </div>
              <div className="text-right">
                <p className="font-semibold">Rs {order.totalPkr}</p>
                <Link href={`/order-confirmation/${order.id}`} className="text-brand-navy underline">
                  {order.status}
                </Link>
                {order.status === 'completed' && <ReviewButton orderId={order.id} accessToken={accessToken} />}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// AC-7 — customer submits a review tied to this completed order; stored pending Admin moderation.
function ReviewButton({ orderId, accessToken }: { orderId: string; accessToken: string | null }) {
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(5);
  const [feedback, setFeedback] = useState('');
  const [serviceUsed, setServiceUsed] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);

  if (submitted) return <p className="mt-1 text-xs text-emerald-600">Review submitted</p>;
  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="mt-1 block text-xs text-brand-navy underline">
        Leave a review
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
      setError(err instanceof ApiClientError ? err.error : { code: 'INTERNAL_ERROR', message: 'Could not submit review.', traceId: '' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-2 w-56 space-y-2 rounded-md border border-gray-200 bg-white p-3 text-left">
      <ErrorBanner error={error} />
      <select value={rating} onChange={(e) => setRating(Number(e.target.value))} className="w-full rounded border border-gray-300 px-2 py-1 text-xs">
        {[5, 4, 3, 2, 1].map((r) => (
          <option key={r} value={r}>
            {'★'.repeat(r)} ({r})
          </option>
        ))}
      </select>
      <input
        value={serviceUsed}
        onChange={(e) => setServiceUsed(e.target.value)}
        placeholder="Service used"
        className="w-full rounded border border-gray-300 px-2 py-1 text-xs"
      />
      <textarea
        value={feedback}
        onChange={(e) => setFeedback(e.target.value)}
        placeholder="Your feedback"
        className="w-full rounded border border-gray-300 px-2 py-1 text-xs"
        rows={3}
      />
      <button disabled={busy} onClick={submit} className="w-full rounded bg-gold-500 px-2 py-1 text-xs font-semibold text-navy-800">
        Submit
      </button>
    </div>
  );
}
