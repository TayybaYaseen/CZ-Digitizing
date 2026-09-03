'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { ApiError } from '@czd/shared-types';
import { ApiClientError, apiFetchWithMeta } from '@/lib/api-client';
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
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
