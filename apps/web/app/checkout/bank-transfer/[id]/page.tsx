'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { ApiError } from '@czd/shared-types';
import { ApiClientError, apiFetch } from '@/lib/api-client';
import { formatPkr } from '@/lib/format';
import { useOrderAccess } from '@/lib/order-access';
import { ErrorBanner, SuccessBanner } from '@/components/ErrorBanner';
import { GuestOrderUnavailable } from '@/components/GuestOrderUnavailable';
import { clientError } from '@/i18n/api-errors';
import { useLocale } from '@/lib/locale-context';

interface OrderDto {
  id: string;
  status: string;
  paymentStatus: string;
  totalPkr: number;
  amountDuePkr: number;
  amountPaidPkr: number;
  amountOutstandingPkr: number;
  creditsUsed: number;
  bankTransferReference: string | null;
  receipts: { id: string; reviewStatus: string; rejectionReason: string | null }[];
}

// docs/specs/2026-08-28-08-orders-payment-processing.md §3/§5/§11 (AC-3/AC-4) — the ONLY payment
// screen: the exact PKR amount to transfer, the bank details Admin configured in Settings (AC-9: read
// live from the public settings endpoint, never hardcoded here, so a change applies at once), the
// order's unique reference, and the receipt upload. A rejected receipt shows Admin's reason and asks for
// a new one. The order is confirmed only when an Admin approves the receipt — nothing here can do it.
// Guest checkout: a visitor who isn't signed in reaches this same page for an order their browser
// placed (useOrderAccess -> /api/guest-orders, authorized by the browser's guest cookie).
export default function BankTransferCheckoutPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  // Signed in: the account's order routes. Not signed in: guest checkout's cookie-scoped routes.
  const access = useOrderAccess();
  // A guest browser asked for an order it doesn't hold the key to (never revealed whether it exists).
  const [unavailable, setUnavailable] = useState(false);
  const { t, tOr, rich } = useLocale();
  const [order, setOrder] = useState<OrderDto | null>(null);
  const [bankConfig, setBankConfig] = useState<Record<string, string> | null>(null);
  // Distinct from bankConfig === null: that's a legitimate "Admin hasn't set up bank transfer
  // yet" state, this is "we couldn't even check" (network/server error) — see
  // docs/incidents/2026-09-07-bank-transfer-details-not-showing.md. Conflating the two used to
  // mean any transient failure silently rendered as an empty details box with no explanation,
  // right when a customer is about to send money.
  const [bankConfigLoadFailed, setBankConfigLoadFailed] = useState(false);
  // Until the settings request settles, bankConfig is still null — without this the page flashed
  // "details aren't available yet" (alarming, right before a payment) for the first moments.
  const [bankConfigLoaded, setBankConfigLoaded] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploaded, setUploaded] = useState(false);
  // Bumped after every upload so the order (and its receipt list) is reloaded from the server.
  const [reload, setReload] = useState(0);

  // Already paid (e.g. credits covered the whole order): there is nothing to transfer and no
  // receipt to upload — go straight to the confirmation.
  useEffect(() => {
    if (order?.paymentStatus === 'completed') router.replace(`/order-confirmation/${order.id}`);
  }, [order, router]);

  useEffect(() => {
    if (!access.ready) return;
    apiFetch<OrderDto>(`${access.base}/${params.id}`, { headers: access.headers })
      .then(setOrder)
      .catch((err) => {
        if (access.guest && err instanceof ApiClientError && err.error.code === 'RESOURCE_NOT_FOUND') setUnavailable(true);
        else setError(err instanceof ApiClientError ? err.error : clientError('errors.loadOrderFailed'));
      });
    apiFetch<{ bankTransferConfig: Record<string, string> | null }>('/api/settings/public')
      .then((s) => {
        setBankConfig(s.bankTransferConfig ?? null);
        setBankConfigLoaded(true);
      })
      .catch(() => {
        setBankConfigLoadFailed(true);
        setBankConfigLoaded(true);
      });
  }, [access.ready, access.base, access.headers, access.guest, params.id, reload]);

  async function onUpload() {
    if (!file) return;
    setError(null);
    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      await apiFetch(`${access.base}/${params.id}/receipt`, { method: 'POST', body: form, headers: access.headers });
      setUploaded(true);
      setFile(null);
      setReload((n) => n + 1);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.error : clientError('errors.receiptUploadFailed'));
    } finally {
      setUploading(false);
    }
  }

  if (!access.ready) return null;
  if (unavailable) return <GuestOrderUnavailable />;
  if (!order && error) return <div className="mx-auto max-w-lg"><ErrorBanner error={error} /></div>;
  if (!order) return <p className="mx-auto max-w-lg text-center text-sm text-gray-500">{t('orders.loadingOrder')}</p>;
  if (order.paymentStatus === 'completed') return null; // redirecting to the confirmation

  const latestReceipt = order.receipts[0];
  const receiptAwaitingReview = uploaded || latestReceipt?.reviewStatus === 'pending';
  const orderClosed = order.status !== 'payment_pending';

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <h1 className="text-2xl font-bold">{t('checkout.bankTransfer')}</h1>
      {access.guest && (
        <p className="rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm text-gray-700" data-testid="guest-order-saved">
          {t('orders.orderId', { id: order.id })} · {t('checkout.guestOrderSaved')}
        </p>
      )}

      <div className="space-y-2 rounded-lg border border-gray-200 bg-white p-4 text-sm">
        <p>{t('bankTransfer.intro')}</p>
        <p className="rounded bg-brand-navy/5 px-3 py-2 text-base" data-testid="amount-due">
          {rich('bankTransfer.amountToTransfer', { b: () => <strong>{formatPkr(order.amountOutstandingPkr)}</strong> })}
        </p>
        {order.amountPaidPkr > 0 && <p className="text-gray-500">{t('bankTransfer.partiallyConfirmed', { amount: formatPkr(order.amountPaidPkr) })}</p>}
        {order.creditsUsed > 0 && (
          <p className="text-gray-500">{t('bankTransfer.creditsNote', { total: formatPkr(order.totalPkr), credits: formatPkr(order.creditsUsed) })}</p>
        )}
        <p>{t('bankTransfer.includeReference')}</p>
        {bankConfigLoadFailed ? (
          <p className="rounded bg-amber-50 px-3 py-2 text-amber-800">{t('bankTransfer.detailsLoadFailed')}</p>
        ) : !bankConfigLoaded ? (
          <p className="text-gray-400">{t('bankTransfer.loadingDetails')}</p>
        ) : bankConfig ? (
          <>
            {bankConfig.bankName && <p>{t('bankTransfer.bank')} {bankConfig.bankName}</p>}
            {bankConfig.accountTitle && <p>{t('bankTransfer.accountTitle')} {bankConfig.accountTitle}</p>}
            {bankConfig.accountNumber && <p>{t('bankTransfer.accountNumber')} <span dir="ltr">{bankConfig.accountNumber}</span></p>}
            {bankConfig.iban && <p>IBAN: <span dir="ltr">{bankConfig.iban}</span></p>}
            {bankConfig.instructions && <p className="whitespace-pre-line text-gray-600">{bankConfig.instructions}</p>}
          </>
        ) : (
          <p className="rounded bg-amber-50 px-3 py-2 text-amber-800">{t('bankTransfer.detailsUnavailable')}</p>
        )}
        <p dir="ltr" className="mt-2 rounded bg-gray-50 px-3 py-2 text-start font-mono text-base font-semibold text-brand-navy">{order.bankTransferReference}</p>
      </div>

      {latestReceipt?.reviewStatus === 'rejected' && !uploaded && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" data-testid="receipt-rejected">
          <p className="font-semibold">{t('bankTransfer.receiptRejected')}</p>
          {latestReceipt.rejectionReason && <p>{t('bankTransfer.reason', { reason: latestReceipt.rejectionReason })}</p>}
          <p>{t('bankTransfer.checkAndReupload')}</p>
        </div>
      )}

      {orderClosed ? (
        <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700">
          {t('bankTransfer.orderClosed', { status: tOr(`orderStatus.${order.status}`, order.status) })}
        </div>
      ) : receiptAwaitingReview ? (
        <SuccessBanner message={t('bankTransfer.receiptReceived')} />
      ) : (
        <div className="space-y-3 rounded-lg border border-gray-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-brand-navy">{latestReceipt?.reviewStatus === 'rejected' ? t('bankTransfer.uploadNewReceipt') : t('bankTransfer.uploadReceipt')}</h2>
          <input type="file" aria-label={t('bankTransfer.uploadReceipt')} accept="image/jpeg,image/png,image/webp,application/pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="text-sm" />
          <ErrorBanner error={error} />
          <button
            onClick={onUpload}
            disabled={!file || uploading}
            className="w-full rounded-md bg-brand-gold px-4 py-2 text-sm font-semibold text-brand-navy disabled:opacity-50"
          >
            {uploading ? t('common.uploading') : t('bankTransfer.uploadButton')}
          </button>
        </div>
      )}
    </div>
  );
}
