'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import type { ApiError } from '@czd/shared-types';
import { ApiClientError, apiFetch } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { ErrorBanner } from '@/components/ErrorBanner';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';

// Mirrors apps/api/src/orders/dto/order.dto.ts's OrderSummaryDto.
interface OrderSummaryDto {
  id: string;
  status: string;
  paymentStatus: string;
  paymentMethod: string;
  totalPkr: number;
  itemCount: number;
  createdAt: string;
}

const STATUS_TONE: Record<string, 'success' | 'warning' | 'danger' | 'neutral'> = {
  pending: 'neutral',
  payment_pending: 'warning',
  payment_confirmed: 'success',
  processing: 'success',
  ready: 'success',
  completed: 'success',
  cancelled: 'danger',
  refunded: 'danger',
};

const STATUSES = ['pending', 'payment_pending', 'payment_confirmed', 'processing', 'ready', 'completed', 'cancelled', 'refunded'];

// docs/specs/2026-08-28-08-orders-payment-processing.md §3 (aspect A-013) — GET /api/orders,
// admin, filterable by status. Replaces the ComingSoon placeholder now that A-013 has shipped.
export default function OrdersAdminPage() {
  const router = useRouter();
  const { user, accessToken, isReady } = useAuth();
  const [orders, setOrders] = useState<OrderSummaryDto[] | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [statusFilter, setStatusFilter] = useState('');

  const load = useCallback(async () => {
    if (!accessToken) return;
    setError(null);
    try {
      const query = new URLSearchParams({ page: '1', pageSize: '50', ...(statusFilter ? { status: statusFilter } : {}) });
      const list = await apiFetch<OrderSummaryDto[]>(`/api/orders?${query.toString()}`, { headers: { Authorization: `Bearer ${accessToken}` } });
      setOrders(list);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.error : { code: 'INTERNAL_ERROR', message: 'Failed to load orders.', traceId: '' });
    }
  }, [accessToken, statusFilter]);

  useEffect(() => {
    if (!isReady) return;
    if (!user) {
      router.replace('/login');
      return;
    }
    load();
  }, [isReady, user, load, router]);

  if (!isReady || !user) return null;

  return (
    <div className="max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold text-navy-800">Orders</h1>
          <p className="mt-1 text-sm text-gray-500">{orders?.length ?? 0} orders</p>
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="rounded-field border border-gray-300 px-3 py-1.5 text-sm">
          <option value="">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      <ErrorBanner error={error} />

      <Card padding="p-0">
        {orders === null ? (
          <p className="p-4 text-sm text-gray-400">Loading…</p>
        ) : orders.length === 0 ? (
          <p className="p-4 text-sm text-gray-400">No orders yet.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-xs uppercase tracking-wide text-gray-400">
                <th className="px-4 py-3 font-medium">Order</th>
                <th className="px-4 py-3 font-medium">Method</th>
                <th className="px-4 py-3 font-medium">Total</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Placed</th>
                <th className="px-4 py-3 text-right font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id} className="border-b border-gray-100 last:border-0">
                  <td className="px-4 py-3 font-semibold text-navy-800">#{order.id}</td>
                  <td className="px-4 py-3 capitalize">{order.paymentMethod.replace('_', ' ')}</td>
                  <td className="px-4 py-3">Rs {order.totalPkr}</td>
                  <td className="px-4 py-3">
                    <Badge tone={STATUS_TONE[order.status] ?? 'neutral'}>{order.status}</Badge>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{new Date(order.createdAt).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/orders/${order.id}`} className="text-sm font-semibold text-navy-800 underline">
                      View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
