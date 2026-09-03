'use client';

import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import type { ApiError } from '@czd/shared-types';
import { ApiClientError, apiFetch } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { ErrorBanner, SuccessBanner } from '@/components/ErrorBanner';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';

interface OrderItemDto {
  id: string;
  name: string;
  sizeLabel: string | null;
  quantity: number;
  unitPricePkr: number;
  linePricePkr: number;
}

interface PaymentReceiptDto {
  id: string;
  uploadedAt: string;
  reviewStatus: string;
  reviewedAt: string | null;
  rejectionReason: string | null;
}

interface OrderDto {
  id: string;
  customerId: string;
  status: string;
  paymentStatus: string;
  paymentMethod: string;
  totalPkr: number;
  refundedAmountPkr: number | null;
  bankTransferReference: string | null;
  items: OrderItemDto[];
  receipts: PaymentReceiptDto[];
  createdAt: string;
}

// docs/specs/2026-08-28-08-orders-payment-processing.md §3 (AC-5/AC-11) — manual status
// transitions (bank-transfer path), receipt review (confirm/reject with a reason), and a refund
// action. Valid next-states are those the state machine (order-state-machine.ts) actually allows —
// this UI intentionally doesn't hardcode a subset, letting a rejected PUT surface INVALID_ORDER_TRANSITION
// rather than silently hiding options the backend might legitimately allow later.
const ALL_STATUSES = ['pending', 'payment_pending', 'payment_confirmed', 'processing', 'ready', 'completed', 'cancelled', 'refunded'];

export default function OrderDetailAdminPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const { user, accessToken, isReady } = useAuth();
  const [order, setOrder] = useState<OrderDto | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [nextStatus, setNextStatus] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');

  const load = useCallback(async () => {
    if (!accessToken) return;
    try {
      const dto = await apiFetch<OrderDto>(`/api/orders/${params.id}`, { headers: { Authorization: `Bearer ${accessToken}` } });
      setOrder(dto);
      setNextStatus(dto.status);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.error : { code: 'INTERNAL_ERROR', message: 'Failed to load order.', traceId: '' });
    }
  }, [accessToken, params.id]);

  useEffect(() => {
    if (!isReady) return;
    if (!user) {
      router.replace('/login');
      return;
    }
    load();
  }, [isReady, user, load, router]);

  async function updateStatus() {
    setError(null);
    setSuccess(null);
    try {
      await apiFetch(`/api/orders/${params.id}/status`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ status: nextStatus }),
      });
      setSuccess(`Order moved to "${nextStatus}".`);
      load();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.error : { code: 'INTERNAL_ERROR', message: 'Status update failed.', traceId: '' });
    }
  }

  async function reviewReceipt(approve: boolean) {
    setError(null);
    setSuccess(null);
    try {
      await apiFetch(`/api/orders/${params.id}/payment-confirmation`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ approve, rejectionReason: approve ? undefined : rejectionReason || undefined }),
      });
      setSuccess(approve ? 'Payment confirmed — files released to the customer.' : 'Receipt rejected.');
      setRejectionReason('');
      load();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.error : { code: 'INTERNAL_ERROR', message: 'Receipt review failed.', traceId: '' });
    }
  }

  async function refund() {
    setError(null);
    setSuccess(null);
    try {
      await apiFetch(`/api/orders/${params.id}/refund`, { method: 'PUT', headers: { Authorization: `Bearer ${accessToken}` }, body: JSON.stringify({}) });
      setSuccess('Order refunded in full.');
      load();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.error : { code: 'INTERNAL_ERROR', message: 'Refund failed.', traceId: '' });
    }
  }

  if (!isReady || !user) return null;
  if (!order) return <p className="p-4 text-sm text-gray-400">Loading…</p>;

  const latestReceipt = order.receipts[0];

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold text-navy-800">Order #{order.id}</h1>
        <p className="mt-1 text-sm text-gray-500">
          Customer #{order.customerId} · {order.paymentMethod.replace('_', ' ')} · <Badge tone="neutral">{order.status}</Badge>
        </p>
      </div>

      <ErrorBanner error={error} />
      {success && <SuccessBanner message={success} />}

      <Card title="Items">
        <table className="w-full text-left text-sm">
          <tbody>
            {order.items.map((item) => (
              <tr key={item.id} className="border-b border-gray-100 last:border-0">
                <td className="py-2">
                  {item.name} {item.sizeLabel ? `(${item.sizeLabel})` : ''} × {item.quantity}
                </td>
                <td className="py-2 text-right">Rs {item.linePricePkr}</td>
              </tr>
            ))}
            <tr>
              <td className="pt-2 font-semibold">Total</td>
              <td className="pt-2 text-right font-semibold">Rs {order.totalPkr}</td>
            </tr>
          </tbody>
        </table>
      </Card>

      {order.paymentMethod === 'bank_transfer' && (
        <Card title="Bank Transfer Receipt">
          <p className="text-sm text-gray-500">Reference: {order.bankTransferReference}</p>
          {!latestReceipt ? (
            <p className="mt-2 text-sm text-gray-400">No receipt uploaded yet.</p>
          ) : (
            <div className="mt-3 space-y-3">
              <p className="text-sm">
                Latest receipt uploaded {new Date(latestReceipt.uploadedAt).toLocaleString()} — <Badge tone="neutral">{latestReceipt.reviewStatus}</Badge>
              </p>
              {latestReceipt.reviewStatus === 'pending' && (
                <div className="space-y-2">
                  <textarea
                    placeholder="Rejection reason (shown to the customer if rejected)"
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    className="w-full rounded-field border border-gray-300 px-3 py-2 text-sm"
                    rows={2}
                  />
                  <div className="flex gap-2">
                    <Button onClick={() => reviewReceipt(true)}>Confirm Payment</Button>
                    <Button variant="outlineNavy" onClick={() => reviewReceipt(false)}>
                      Reject
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </Card>
      )}

      <Card title="Manual Status Transition">
        <div className="flex items-center gap-2">
          <select value={nextStatus} onChange={(e) => setNextStatus(e.target.value)} className="rounded-field border border-gray-300 px-3 py-1.5 text-sm">
            {ALL_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <Button onClick={updateStatus} disabled={nextStatus === order.status}>
            Apply
          </Button>
        </div>
      </Card>

      <Card title="Refund">
        <p className="text-sm text-gray-500">
          {order.refundedAmountPkr ? `Rs ${order.refundedAmountPkr} refunded so far.` : 'No refund issued yet.'}
        </p>
        <Button
          variant="outlineNavy"
          className="mt-2"
          onClick={refund}
          disabled={order.paymentStatus !== 'completed' && order.paymentStatus !== 'partially_refunded'}
        >
          Issue full refund
        </Button>
      </Card>
    </div>
  );
}
