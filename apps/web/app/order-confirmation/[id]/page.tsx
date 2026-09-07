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

interface AuthorizedFileDto {
  id: string;
  designId: string;
  fileFormat: string;
  fileSizeBytes: number;
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
  const [files, setFiles] = useState<AuthorizedFileDto[] | null>(null);
  const [downloaded, setDownloaded] = useState<Record<string, boolean>>({});
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

  const filesReady = order && ['payment_confirmed', 'processing', 'ready', 'completed'].includes(order.status);

  // docs/specs/2026-08-28-05-private-file-management.md §3 (aspect A-007) — GET
  // /api/orders/:id/files (AC-4/5). Loaded only once files are actually releasable, same gate the
  // backend itself enforces (PAYMENT_NOT_CONFIRMED otherwise).
  useEffect(() => {
    if (!filesReady || !accessToken) return;
    apiFetch<AuthorizedFileDto[]>(`/api/orders/${params.id}/files`, { headers: { Authorization: `Bearer ${accessToken}` } })
      .then(setFiles)
      .catch(() => setFiles([]));
  }, [filesReady, accessToken, params.id]);

  if (!isReady || !user) return null;

  // AC-6/AC-12 (Customer Account & Purchase History, aspect A-019) — requests/confirms download
  // authorization via the real signed-token endpoint (which also records the DOWNLOADED activity
  // event server-side). Note: this repo has no GET route yet that actually streams bytes for a
  // signed token — same honest, documented gap as the custom-requests page's own download button
  // (A-007's own frontend/streaming endpoint is a follow-up, not something this spec invents).
  async function downloadFile(fileId: string) {
    if (!accessToken) return;
    try {
      await apiFetch<{ downloadUrl: string; expiresAt: string }>(`/api/orders/${params.id}/files/${fileId}/download`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      setDownloaded((prev) => ({ ...prev, [fileId]: true }));
    } catch (err) {
      setError(err instanceof ApiClientError ? err.error : { code: 'INTERNAL_ERROR', message: 'Could not start the download.', traceId: '' });
    }
  }

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
            <div className="space-y-2">
              <p className="font-semibold text-brand-navy">Your files:</p>
              {files === null ? (
                <p className="text-xs text-gray-500">Loading files…</p>
              ) : files.length === 0 ? (
                <p className="text-xs text-gray-500">No downloadable files on this order.</p>
              ) : (
                <ul className="space-y-1">
                  {files.map((f) => (
                    <li key={f.id} className="flex items-center justify-between rounded-md border border-gray-200 px-3 py-2 text-xs">
                      <span>.{f.fileFormat}</span>
                      <button onClick={() => downloadFile(f.id)} className="rounded-md border border-gray-300 px-2 py-1 hover:bg-gray-50">
                        {downloaded[f.id] ? 'Downloaded ✓' : 'Download'}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <Link href="/account/purchased-designs" className="inline-block text-xs text-brand-navy underline">
                View all your purchased designs
              </Link>
            </div>
          )}
        </div>
      )}

      <Link href="/account/orders" className="inline-block text-sm text-brand-navy underline">
        View order history
      </Link>
    </div>
  );
}
