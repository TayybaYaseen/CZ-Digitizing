'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { ApiError } from '@czd/shared-types';
import { ApiClientError, apiFetch } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { ErrorBanner, SuccessBanner } from '@/components/ErrorBanner';

interface OrderDto {
  id: string;
  status: string;
  totalPkr: number;
  bankTransferReference: string | null;
  receipts: { id: string; reviewStatus: string; rejectionReason: string | null }[];
}

// docs/specs/2026-08-28-08-orders-payment-processing.md §3/§5 (AC-3/AC-4) — bank details (from
// PaymentMethodSetting.config, AC-9's "no code deploy" requirement) plus the order's
// auto-generated reference number and a receipt upload form. Bank display fields are read from
// the public settings endpoint (already exists, A-005) rather than duplicated here.
export default function BankTransferCheckoutPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const { user, accessToken, isReady } = useAuth();
  const [order, setOrder] = useState<OrderDto | null>(null);
  const [bankConfig, setBankConfig] = useState<Record<string, string> | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploaded, setUploaded] = useState(false);

  useEffect(() => {
    if (isReady && !user) router.replace('/login');
  }, [isReady, user, router]);

  useEffect(() => {
    if (!user || !accessToken) return;
    apiFetch<OrderDto>(`/api/orders/${params.id}`, { headers: { Authorization: `Bearer ${accessToken}` } })
      .then(setOrder)
      .catch((err) => setError(err instanceof ApiClientError ? err.error : { code: 'INTERNAL_ERROR', message: 'Could not load order.', traceId: '' }));
    apiFetch<{ bankTransferConfig: Record<string, string> | null }>('/api/settings/public')
      .then((s) => setBankConfig(s.bankTransferConfig ?? null))
      .catch(() => setBankConfig(null));
  }, [user, accessToken, params.id]);

  async function onUpload() {
    if (!file) return;
    setError(null);
    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      await apiFetch(`/api/orders/${params.id}/receipt`, { method: 'POST', body: form, headers: { Authorization: `Bearer ${accessToken}` } });
      setUploaded(true);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.error : { code: 'INTERNAL_ERROR', message: 'Receipt upload failed.', traceId: '' });
    } finally {
      setUploading(false);
    }
  }

  if (!isReady || !user) return null;
  if (!order) return <p className="mx-auto max-w-lg text-center text-sm text-gray-500">Loading order…</p>;

  const latestReceipt = order.receipts[0];

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <h1 className="text-2xl font-bold">Bank Transfer Payment</h1>

      <div className="space-y-2 rounded-lg border border-gray-200 bg-white p-4 text-sm">
        <p>
          Please transfer <strong>Rs {order.totalPkr}</strong> to the account below and include your reference number.
        </p>
        {bankConfig?.bankName && <p>Bank: {bankConfig.bankName}</p>}
        {bankConfig?.accountTitle && <p>Account Title: {bankConfig.accountTitle}</p>}
        {bankConfig?.accountNumber && <p>Account Number: {bankConfig.accountNumber}</p>}
        <p className="mt-2 rounded bg-gray-50 px-3 py-2 font-mono text-base font-semibold text-brand-navy">{order.bankTransferReference}</p>
      </div>

      {latestReceipt?.reviewStatus === 'rejected' && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Your previous receipt was rejected{latestReceipt.rejectionReason ? `: ${latestReceipt.rejectionReason}` : '.'} Please upload a new one.
        </div>
      )}

      {uploaded ? (
        <SuccessBanner message="Receipt uploaded. Admin will review it shortly and you'll be notified once payment is confirmed." />
      ) : (
        <div className="space-y-3 rounded-lg border border-gray-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-brand-navy">Upload Payment Receipt</h2>
          <input type="file" accept="image/*,application/pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="text-sm" />
          <ErrorBanner error={error} />
          <button
            onClick={onUpload}
            disabled={!file || uploading}
            className="w-full rounded-md bg-brand-gold px-4 py-2 text-sm font-semibold text-brand-navy disabled:opacity-50"
          >
            {uploading ? 'Uploading…' : 'Upload Receipt'}
          </button>
        </div>
      )}
    </div>
  );
}
