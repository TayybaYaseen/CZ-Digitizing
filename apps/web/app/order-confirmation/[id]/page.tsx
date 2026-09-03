'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { ApiError } from '@czd/shared-types';
import { ApiClientError, apiFetch } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { ErrorBanner } from '@/components/ErrorBanner';

interface OrderDto {
  id: string;
  status: string;
  paymentMethod: string;
  totalPkr: number;
  bankTransferReference: string | null;
}

const STATUS_LABEL: Record<string, string> = {
  pending: 'Pending',
  payment_pending: 'Awaiting payment confirmation',
  payment_confirmed: 'Payment confirmed',
  processing: 'Processing',
  ready: 'Ready',
  completed: 'Completed',
  cancelled: 'Cancelled',
  refunded: 'Refunded',
};

// docs/specs/2026-08-28-08-orders-payment-processing.md §5 — "order confirmation screen with
// order number, next steps, and (once confirmed) a link to purchased files".
export default function OrderConfirmationPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const { user, accessToken, isReady } = useAuth();
  const [order, setOrder] = useState<OrderDto | null>(null);
  const [error, setError] = useState<ApiError | null>(null);

  useEffect(() => {
    if (isReady && !user) router.replace('/login');
  }, [isReady, user, router]);

  useEffect(() => {
    if (!user || !accessToken) return;
    apiFetch<OrderDto>(`/api/orders/${params.id}`, { headers: { Authorization: `Bearer ${accessToken}` } })
      .then(setOrder)
      .catch((err) => setError(err instanceof ApiClientError ? err.error : { code: 'INTERNAL_ERROR', message: 'Could not load order.', traceId: '' }));
  }, [user, accessToken, params.id]);

  if (!isReady || !user) return null;

  const filesReady = order && ['payment_confirmed', 'processing', 'ready', 'completed'].includes(order.status);

  return (
    <div className="mx-auto max-w-lg space-y-6 text-center">
      <h1 className="text-2xl font-bold">Thank you for your order!</h1>

      <ErrorBanner error={error} />

      {order && (
        <div className="space-y-2 rounded-lg border border-gray-200 bg-white p-6 text-left text-sm">
          <p>
            Order <strong>#{order.id}</strong>
          </p>
          <p>Status: {STATUS_LABEL[order.status] ?? order.status}</p>
          <p>Total: Rs {order.totalPkr}</p>
          {order.paymentMethod === 'bank_transfer' && !filesReady && (
            <p className="text-amber-700">
              We&apos;re waiting for your bank-transfer receipt to be reviewed.{' '}
              <Link href={`/checkout/bank-transfer/${order.id}`} className="underline">
                Upload it here
              </Link>{' '}
              if you haven&apos;t already.
            </p>
          )}
          {!filesReady && order.paymentMethod !== 'bank_transfer' && <p className="text-gray-600">We&apos;ll notify you once payment is confirmed.</p>}
          {filesReady && (
            <Link href="/account/purchased-designs" className="inline-block font-semibold text-brand-navy underline">
              Go to your purchased files
            </Link>
          )}
        </div>
      )}

      <Link href="/account/orders" className="inline-block text-sm text-brand-navy underline">
        View order history
      </Link>
    </div>
  );
}
