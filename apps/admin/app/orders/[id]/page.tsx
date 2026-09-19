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
  contentType: string | null;
  originalFilename: string | null;
}

interface OrderDto {
  id: string;
  customerId: string;
  status: string;
  paymentStatus: string;
  paymentMethod: string;
  totalPkr: number;
  amountDuePkr: number;
  creditsUsed: number;
  providerCharge: { currency: string; amount: string; amountMinor: number; amountPkr: number; rateToPkr: number } | null;
  refundedAmountPkr: number | null;
  bankTransferReference: string | null;
  items: OrderItemDto[];
  receipts: PaymentReceiptDto[];
  createdAt: string;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

// A-013 (AC-4/AC-5) — Admin reviews the receipt BEFORE confirming or rejecting. The file is served
// only to signed-in staff by GET /api/orders/:id/receipts/:receiptId/file (never a public URL), so
// it is fetched with the bearer token and shown from an in-memory object URL.
function ReceiptPreview({ orderId, receipt, accessToken }: { orderId: string; receipt: PaymentReceiptDto; accessToken: string | null }) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  useEffect(() => {
    if (!accessToken) return;
    let revoked = false;
    let url: string | null = null;
    setObjectUrl(null);
    setFailed(null);
    fetch(`${API_URL}/api/orders/${orderId}/receipts/${receipt.id}/file`, { headers: { Authorization: `Bearer ${accessToken}` }, credentials: 'include' })
      .then(async (res) => {
        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
          throw new Error(body?.error?.message ?? `Could not load the receipt (${res.status}).`);
        }
        const blob = await res.blob();
        if (revoked) return;
        url = URL.createObjectURL(blob);
        setObjectUrl(url);
      })
      .catch((err: Error) => !revoked && setFailed(err.message));
    return () => {
      revoked = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [orderId, receipt.id, accessToken]);

  if (failed) return <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{failed}</p>;
  if (!objectUrl) return <p className="text-sm text-gray-400">Loading receipt…</p>;
  if (receipt.contentType === 'application/pdf') {
    return (
      <a href={objectUrl} target="_blank" rel="noopener noreferrer" className="inline-block rounded-field border border-gray-300 px-3 py-2 text-sm font-semibold text-navy-800 hover:bg-gray-100">
        Open PDF receipt{receipt.originalFilename ? ` (${receipt.originalFilename})` : ''}
      </a>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={objectUrl} alt={`Payment receipt for order ${orderId}`} className="max-h-[28rem] max-w-full rounded border border-gray-200 object-contain" />;
}

// docs/specs/2026-08-28-08-orders-payment-processing.md §3 (AC-5/AC-11) — manual status
// transitions (bank-transfer path), receipt review (confirm/reject with a reason), and a refund
// action. Valid next-states are those the state machine (order-state-machine.ts) actually allows —
// this UI intentionally doesn't hardcode a subset, letting a rejected PUT surface INVALID_ORDER_TRANSITION
// rather than silently hiding options the backend might legitimately allow later.
// `payment_confirmed` and `refunded` are deliberately NOT offered: the API refuses them here
// (PAYMENT_CONFIRMATION_REQUIRED / USE_REFUND_ENDPOINT) because a payment is only confirmed by an
// approved receipt or a verified provider payment, and a refund by the Refund action below.
const MANUAL_STATUSES = ['pending', 'payment_pending', 'processing', 'ready', 'completed', 'cancelled'];

export default function OrderDetailAdminPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const { user, accessToken, isReady } = useAuth();
  const [order, setOrder] = useState<OrderDto | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [nextStatus, setNextStatus] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [previewReceiptId, setPreviewReceiptId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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

  // Asks the SERVER to read the payment's real state from PayPal/Stripe (e.g. after a missed
  // webhook). It confirms only if the provider reports a completed payment for exactly this amount.
  async function reverifyWithProvider() {
    setError(null);
    setSuccess(null);
    setBusy(true);
    try {
      const updated = await apiFetch<OrderDto>(`/api/orders/${params.id}/reverify-payment`, { method: 'POST', headers: { Authorization: `Bearer ${accessToken}` } });
      setSuccess(updated.paymentStatus === 'completed' ? 'The provider reports this payment as complete — order confirmed and files released.' : 'The provider has not reported a completed payment yet.');
      load();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.error : { code: 'INTERNAL_ERROR', message: 'Could not check with the provider.', traceId: '' });
    } finally {
      setBusy(false);
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
  const previewReceipt = order.receipts.find((r) => r.id === previewReceiptId) ?? latestReceipt;
  const canReview = order.status === 'payment_pending' && latestReceipt?.reviewStatus === 'pending';
  const statusOptions = MANUAL_STATUSES.includes(order.status) ? MANUAL_STATUSES : [order.status, ...MANUAL_STATUSES];
  const isProviderOrder = order.paymentMethod === 'paypal' || order.paymentMethod === 'stripe';

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
            {order.creditsUsed > 0 && (
              <tr>
                <td className="pt-1 text-gray-500">Paid with credits</td>
                <td className="pt-1 text-right text-gray-500">− Rs {order.creditsUsed}</td>
              </tr>
            )}
            <tr>
              <td className="pt-1 font-semibold">Amount due</td>
              <td className="pt-1 text-right font-semibold">Rs {order.amountDuePkr}</td>
            </tr>
          </tbody>
        </table>
      </Card>

      {isProviderOrder && (
        <Card title={order.paymentMethod === 'paypal' ? 'PayPal Payment' : 'Card Payment (Stripe)'}>
          {order.providerCharge ? (
            <p className="text-sm text-gray-600">
              Charged in <strong>{order.providerCharge.currency} {order.providerCharge.amount}</strong> (Rs {order.providerCharge.amountPkr} at 1 {order.providerCharge.currency} = Rs {order.providerCharge.rateToPkr}).
              Payment is confirmed only when the provider reports exactly this amount.
            </p>
          ) : (
            <p className="text-sm text-gray-400">No provider amount is locked on this order (nothing was due, or it predates payment locking).</p>
          )}
          <p className="mt-2 text-sm text-gray-500">Payment status: <Badge tone="neutral">{order.paymentStatus}</Badge></p>
          {order.status === 'payment_pending' && (
            <Button className="mt-3" variant="outlineNavy" onClick={reverifyWithProvider} disabled={busy}>
              {busy ? 'Checking…' : 'Re-check with provider'}
            </Button>
          )}
        </Card>
      )}

      {order.paymentMethod === 'bank_transfer' && (
        <Card title="Bank Transfer Receipt">
          <p className="text-sm text-gray-500">Reference: {order.bankTransferReference ?? '— (nothing was due)'}</p>
          <p className="mt-1 text-sm font-semibold text-navy-800">Expected transfer: Rs {order.amountDuePkr}</p>
          {order.status !== 'payment_pending' && <p className="mt-2 rounded bg-gray-100 px-3 py-2 text-sm text-gray-600">This order is &quot;{order.status}&quot; — receipts can no longer confirm its payment.</p>}
          {!latestReceipt ? (
            <p className="mt-2 text-sm text-gray-400">No receipt uploaded yet.</p>
          ) : (
            <div className="mt-3 space-y-3">
              {previewReceipt && (
                <div className="space-y-2">
                  <p className="text-xs uppercase tracking-wide text-gray-500">
                    Receipt uploaded {new Date(previewReceipt.uploadedAt).toLocaleString()}
                    {previewReceipt.originalFilename ? ` · ${previewReceipt.originalFilename}` : ''}
                  </p>
                  <ReceiptPreview orderId={order.id} receipt={previewReceipt} accessToken={accessToken} />
                </div>
              )}
              {order.receipts.length > 1 && (
                <div className="space-y-1 border-t border-gray-100 pt-2">
                  <p className="text-xs uppercase tracking-wide text-gray-500">Receipt history</p>
                  {order.receipts.map((r) => (
                    <button key={r.id} type="button" onClick={() => setPreviewReceiptId(r.id)} className={`block text-left text-sm underline ${r.id === previewReceipt?.id ? 'font-semibold text-navy-800' : 'text-gray-600'}`}>
                      {new Date(r.uploadedAt).toLocaleString()} — {r.reviewStatus}
                      {r.rejectionReason ? ` (${r.rejectionReason})` : ''}
                    </button>
                  ))}
                </div>
              )}
              <p className="text-sm">
                Latest receipt — <Badge tone="neutral">{latestReceipt.reviewStatus}</Badge>
                {latestReceipt.reviewStatus === 'rejected' && latestReceipt.rejectionReason ? ` — ${latestReceipt.rejectionReason}` : ''}
              </p>
              {canReview && (
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
            {statusOptions.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <Button onClick={updateStatus} disabled={nextStatus === order.status}>
            Apply
          </Button>
        </div>
        <p className="mt-2 text-xs text-gray-500">Payment can&apos;t be confirmed or refunded from here — use Confirm Payment / Re-check with provider above, or the Refund action below.</p>
      </Card>

      <Card title="Refund">
        <p className="text-sm text-gray-500">
          {order.refundedAmountPkr ? `Rs ${order.refundedAmountPkr} refunded so far.` : 'No refund issued yet.'}
        </p>
        <p className="mt-1 text-xs text-gray-500">
          This records the refund in this system (status, credits, the customer&apos;s access and notification). It does <strong>not</strong> send money back — refund the customer at
          PayPal, Stripe or your bank separately.
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
