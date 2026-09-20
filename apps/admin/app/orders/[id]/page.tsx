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
  confirmedAmountPkr: number | null;
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
  amountPaidPkr: number;
  amountOutstandingPkr: number;
  filesUnlocked: boolean;
  creditsUsed: number;
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

// docs/specs/2026-08-28-08-orders-payment-processing.md §3/§11 (AC-5/AC-11) — BANK TRANSFER ONLY: manual
// status transitions, receipt review (confirm / reject with a reason), and a MANUAL refund record. Valid next-states are those the state machine (order-state-machine.ts) actually allows —
// this UI intentionally doesn't hardcode a subset, letting a rejected PUT surface INVALID_ORDER_TRANSITION
// rather than silently hiding options the backend might legitimately allow later.
// `payment_confirmed` and `refunded` are deliberately NOT offered: the API refuses them here
// (PAYMENT_CONFIRMATION_REQUIRED / USE_REFUND_ENDPOINT) because a payment is only confirmed by an
// approved receipt, and a refund by the Refund action below.
const MANUAL_STATUSES = ['pending', 'payment_pending', 'processing', 'ready', 'completed', 'cancelled'];

export default function OrderDetailAdminPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const { user, accessToken, isReady } = useAuth();
  const [order, setOrder] = useState<OrderDto | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  // Input mistakes caught before any request is sent. Shown inline: ErrorBanner deliberately hides
  // VALIDATION_ERROR (it is for field-level API errors), so routing these through it showed nothing.
  const [inputError, setInputError] = useState<string | null>(null);
  const [nextStatus, setNextStatus] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [previewReceiptId, setPreviewReceiptId] = useState<string | null>(null);
  const [refundAmount, setRefundAmount] = useState('');
  const [receivedAmount, setReceivedAmount] = useState('');

  const load = useCallback(async () => {
    if (!accessToken) return;
    try {
      const dto = await apiFetch<OrderDto>(`/api/orders/${params.id}`, { headers: { Authorization: `Bearer ${accessToken}` } });
      setOrder(dto);
      setNextStatus(dto.status);
      setReceivedAmount(String(dto.amountOutstandingPkr));
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
    setInputError(null);
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

  // Files unlock only once the order is 100% paid: confirming less than what is outstanding records a
  // PARTIAL payment and leaves the order unpaid and the files locked (the API decides — this is just the input).
  async function reviewReceipt(approve: boolean) {
    setError(null);
    setInputError(null);
    setSuccess(null);
    const amountPkr = Number(receivedAmount);
    if (approve && !(amountPkr > 0)) {
      setInputError('Enter the amount (PKR) you confirmed as received for this receipt — it cannot be left empty.');
      return;
    }
    try {
      const updated = await apiFetch<OrderDto>(`/api/orders/${params.id}/payment-confirmation`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ approve, ...(approve ? { amountPkr } : { rejectionReason: rejectionReason || undefined }) }),
      });
      setSuccess(
        !approve
          ? 'Receipt rejected.'
          : updated.filesUnlocked
            ? 'Payment confirmed in full — files released to the customer.'
            : `Partial payment recorded — PKR ${updated.amountOutstandingPkr} is still outstanding. The order is NOT paid and the customer's files stay locked.`,
      );
      setRejectionReason('');
      load();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.error : { code: 'INTERNAL_ERROR', message: 'Receipt review failed.', traceId: '' });
    }
  }

  // Refunds are MANUAL: this only records that the money was (or is being) returned to the customer's bank
  // account, and keeps the order / credits / customer notification consistent with that.
  async function refund() {
    setError(null);
    setInputError(null);
    setSuccess(null);
    const amountPkr = refundAmount.trim() ? Number(refundAmount) : undefined;
    if (amountPkr !== undefined && (!Number.isInteger(amountPkr) || amountPkr < 1)) {
      setInputError('Enter a whole number of rupees, or leave it empty to refund everything that is left.');
      return;
    }
    const what = amountPkr === undefined ? 'the full remaining amount' : `PKR ${amountPkr}`;
    if (!window.confirm(`Record a refund of ${what} for order #${params.id}? This does not send any money — return it to the customer's bank account yourself.`)) return;
    try {
      await apiFetch(`/api/orders/${params.id}/refund`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify(amountPkr === undefined ? {} : { amountPkr }),
      });
      setSuccess('Refund recorded. Remember to return the money to the customer manually.');
      setRefundAmount('');
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

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold text-navy-800">Order #{order.id}</h1>
        <p className="mt-1 text-sm text-gray-500">
          Customer #{order.customerId} · Bank transfer · <Badge tone="neutral">{order.status}</Badge>
        </p>
      </div>

      <ErrorBanner error={error} />
      {inputError && (
        <div role="alert" className="rounded-field border border-red-200 bg-status-redBg px-4 py-3 text-sm text-status-redFg">
          {inputError}
        </div>
      )}
      {success && <SuccessBanner message={success} />}

      <Card title="Items">
        <table className="w-full text-left text-sm">
          <tbody>
            {order.items.map((item) => (
              <tr key={item.id} className="border-b border-gray-100 last:border-0">
                <td className="py-2">
                  {item.name} {item.sizeLabel ? `(${item.sizeLabel})` : ''} × {item.quantity}
                </td>
                <td className="py-2 text-right">PKR {item.linePricePkr}</td>
              </tr>
            ))}
            <tr>
              <td className="pt-2 font-semibold">Total</td>
              <td className="pt-2 text-right font-semibold">PKR {order.totalPkr}</td>
            </tr>
            {order.creditsUsed > 0 && (
              <tr>
                <td className="pt-1 text-gray-500">Paid with credits</td>
                <td className="pt-1 text-right text-gray-500">− PKR {order.creditsUsed}</td>
              </tr>
            )}
            <tr>
              <td className="pt-1 font-semibold">Amount to be transferred</td>
              <td className="pt-1 text-right font-semibold">PKR {order.amountDuePkr}</td>
            </tr>
          </tbody>
        </table>
      </Card>

      <Card title="Bank Transfer Payment">
          <p className="text-sm text-gray-500">
            Payment status: <Badge tone="neutral">{order.paymentStatus}</Badge>
          </p>
          <p className="mt-1 text-sm text-gray-500">Reference: {order.bankTransferReference ?? '— (nothing was due)'}</p>
          <p className="mt-1 text-sm font-semibold text-navy-800">Expected transfer: PKR {order.amountDuePkr}</p>
          <p className="mt-1 text-sm text-gray-500">
            Confirmed so far: PKR {order.amountPaidPkr} · Still outstanding: PKR {order.amountOutstandingPkr} · Customer files: <strong>{order.filesUnlocked ? 'unlocked' : 'locked'}</strong>
          </p>
          <p className="mt-1 text-xs text-gray-500">Files unlock only when 100% of the order has been paid and confirmed. A partial payment, and any refund (partial included), keeps them locked.</p>
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
                      {r.confirmedAmountPkr !== null ? ` (PKR ${r.confirmedAmountPkr} confirmed)` : ''}
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
                  <label className="block text-sm text-gray-600">
                    Amount received for this receipt (PKR) — outstanding is PKR {order.amountOutstandingPkr}. Confirming less records a partial payment: the order stays unpaid and files stay locked.
                    <input
                      type="number"
                      min={0.01}
                      step="0.01"
                      value={receivedAmount}
                      onChange={(e) => setReceivedAmount(e.target.value)}
                      className="mt-1 block w-48 rounded-field border border-gray-300 px-3 py-1.5 text-sm"
                    />
                  </label>
                  <textarea
                    placeholder="Rejection reason — required to reject; shown to the customer with a request for a new receipt"
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    className="w-full rounded-field border border-gray-300 px-3 py-2 text-sm"
                    rows={2}
                  />
                  <div className="flex gap-2">
                    <Button onClick={() => reviewReceipt(true)}>Confirm Payment</Button>
                    <Button variant="outlineNavy" onClick={() => reviewReceipt(false)} disabled={!rejectionReason.trim()}>
                      Reject
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </Card>

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
        <p className="mt-2 text-xs text-gray-500">Payment can&apos;t be confirmed or refunded from here — use Confirm Payment (after reviewing the receipt) above, or the Refund action below.</p>
      </Card>

      <Card title="Refund">
        <p className="text-sm text-gray-500">
          Paid by bank transfer: <strong>PKR {order.amountDuePkr}</strong> · {order.refundedAmountPkr ? `PKR ${order.refundedAmountPkr} recorded as refunded so far` : 'no refund recorded yet'} · refundable now:{' '}
          <strong>PKR {Math.max(0, order.amountDuePkr - (order.refundedAmountPkr ?? 0))}</strong>
        </p>
        <p className="mt-1 text-xs text-gray-500">
          Refunds are <strong>manual</strong>: return the money to the customer&apos;s bank account yourself, then record it here. You can refund at most what the customer actually transferred; any credits the
          order used are restored automatically once the refund is complete. Any refund — a partial one included — re-locks the customer&apos;s files immediately and notifies them; it does <strong>not</strong> send money.
        </p>
        <div className="mt-2 flex items-center gap-2">
          <input
            type="number"
            min={1}
            value={refundAmount}
            onChange={(e) => setRefundAmount(e.target.value)}
            placeholder="Amount in PKR (empty = everything left)"
            className="w-64 rounded-field border border-gray-300 px-3 py-1.5 text-sm"
          />
          <Button variant="outlineNavy" onClick={refund} disabled={order.paymentStatus !== 'completed' && order.paymentStatus !== 'partially_refunded'}>
            Record refund
          </Button>
        </div>
      </Card>
    </div>
  );
}
