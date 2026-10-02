'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { ApiError } from '@czd/shared-types';
import { ApiClientError, apiFetch } from '@/lib/api-client';
import { formatPkr } from '@/lib/format';
import { useOrderAccess } from '@/lib/order-access';
import { ErrorBanner } from '@/components/ErrorBanner';
import { GuestOrderUnavailable } from '@/components/GuestOrderUnavailable';
import { clientError } from '@/i18n/api-errors';
import { useLocale } from '@/lib/locale-context';

interface OrderDto {
  id: string;
  status: string;
  paymentStatus: string;
  paymentMethod: string;
  totalPkr: number;
  amountDuePkr: number;
  amountOutstandingPkr: number;
  filesUnlocked: boolean;
  creditsUsed: number;
  bankTransferReference: string | null;
}

interface AuthorizedFileDto {
  id: string;
  designId: string;
  fileFormat: string;
  fileSizeBytes: number;
}


// docs/specs/2026-08-28-08-orders-payment-processing.md §5 — "order confirmation screen with
// order number, next steps, and (once confirmed) a link to purchased files". Bank transfer only.
export default function OrderConfirmationPage() {
  const params = useParams<{ id: string }>();
  // Signed in: the account's order routes. Not signed in: guest checkout's cookie-scoped routes —
  // the same order, payment gate and download rules, reached through the browser's guest key.
  const access = useOrderAccess();
  const { t, tOr, rich } = useLocale();
  const [order, setOrder] = useState<OrderDto | null>(null);
  const [files, setFiles] = useState<AuthorizedFileDto[] | null>(null);
  const [downloaded, setDownloaded] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<ApiError | null>(null);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    if (!access.ready) return;
    apiFetch<OrderDto>(`${access.base}/${params.id}`, { headers: access.headers })
      .then(setOrder)
      .catch((err) => {
        if (access.guest && err instanceof ApiClientError && err.error.code === 'RESOURCE_NOT_FOUND') setUnavailable(true);
        else setError(err instanceof ApiClientError ? err.error : clientError('errors.loadOrderFailed'));
      });
  }, [access.ready, access.base, access.headers, access.guest, params.id]);

  // Files are only offered once the SERVER reports them unlocked — the order is 100% paid and confirmed by
  // an Admin (or credits covered all of it) and nothing was refunded. This page merely reads that decision
  // and can never mark an order paid itself; the download routes re-check it on every request anyway.
  const filesReady = order?.filesUnlocked === true;

  // docs/specs/2026-08-28-05-private-file-management.md §3 (aspect A-007) — GET
  // /api/orders/:id/files (AC-4/5). Loaded only once files are actually releasable, same gate the
  // backend itself enforces (PAYMENT_NOT_CONFIRMED otherwise).
  useEffect(() => {
    if (!filesReady || !access.ready) return;
    apiFetch<AuthorizedFileDto[]>(`${access.base}/${params.id}/files`, { headers: access.headers })
      .then(setFiles)
      .catch(() => setFiles([]));
  }, [filesReady, access.ready, access.base, access.headers, params.id]);

  if (!access.ready) return null;
  if (unavailable) return <GuestOrderUnavailable />;

  // AC-6/AC-12 (Customer Account & Purchase History, aspect A-019) — requests/confirms download
  // authorization via the real signed-token endpoint (which also records the DOWNLOADED activity
  // event server-side). Note: this repo has no GET route yet that actually streams bytes for a
  // signed token — same honest, documented gap as the custom-requests page's own download button
  // (A-007's own frontend/streaming endpoint is a follow-up, not something this spec invents).
  async function downloadFile(fileId: string) {
    try {
      await apiFetch<{ downloadUrl: string; expiresAt: string }>(`${access.base}/${params.id}/files/${fileId}/download`, {
        method: 'POST',
        headers: access.headers,
      });
      setDownloaded((prev) => ({ ...prev, [fileId]: true }));
    } catch (err) {
      setError(err instanceof ApiClientError ? err.error : clientError('errors.downloadFailed'));
    }
  }

  return (
    <div className="mx-auto max-w-lg space-y-6 text-center">
      <h1 className="text-2xl font-bold">{t('checkout.orderSuccess')}</h1>

      <ErrorBanner error={error} />

      {order && (
        <div className="space-y-2 rounded-lg border border-gray-200 bg-white p-6 text-start text-sm">
          <p>{rich('orders.orderNumber', { b: () => <strong>#{order.id}</strong> })}</p>
          <p>{t('orders.statusLine', { status: tOr(`orderStatus.${order.status}`, order.status) })}</p>
          <p>{t('orders.totalLine', { amount: formatPkr(order.totalPkr) })}</p>
          {order.creditsUsed > 0 && <p>{t('orders.paidWithCredits', { amount: formatPkr(order.creditsUsed) })}</p>}
          {order.status === 'payment_pending' && order.paymentStatus !== 'completed' && (
            <p className="text-amber-700">
              {t('orders.bankTransferPending', { amount: formatPkr(order.amountOutstandingPkr) })}{' '}
              <Link href={`/checkout/bank-transfer/${order.id}`} className="underline">
                {t('orders.seeBankDetails')}
              </Link>
            </p>
          )}
          {filesReady && (
            <div className="space-y-2">
              <p className="font-semibold text-brand-navy">{t('orders.yourFiles')}</p>
              {files === null ? (
                <p className="text-xs text-gray-500">{t('orders.loadingFiles')}</p>
              ) : files.length === 0 ? (
                <p className="text-xs text-gray-500">{t('orders.noFiles')}</p>
              ) : (
                <ul className="space-y-1">
                  {files.map((f) => (
                    <li key={f.id} className="flex items-center justify-between rounded-md border border-gray-200 px-3 py-2 text-xs">
                      <span>.{f.fileFormat}</span>
                      <button onClick={() => downloadFile(f.id)} className="rounded-md border border-gray-300 px-2 py-1 hover:bg-gray-50">
                        {downloaded[f.id] ? t('products.downloaded') : t('products.download')}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {!access.guest && (
                <Link href="/account/purchased-designs" className="inline-block text-xs text-brand-navy underline">
                  {t('orders.viewAllPurchased')}
                </Link>
              )}
            </div>
          )}
        </div>
      )}

      {access.guest ? (
        <div className="space-y-2">
          <Link href="/account/orders" className="inline-block text-sm text-brand-navy underline">
            {t('nav.yourOrders')}
          </Link>
          <p className="text-xs text-gray-500">{t('homeOrders.savedOnBrowser')}</p>
        </div>
      ) : (
        <Link href="/account/orders" className="inline-block text-sm text-brand-navy underline">
          {t('orders.viewHistory')}
        </Link>
      )}
    </div>
  );
}
