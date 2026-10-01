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

// Mirrors apps/api/src/orders/dto/order.dto.ts's AdminOrderSummaryDto.
interface QueueRow {
  id: string;
  customerId: string;
  customerEmail: string;
  customerDisplayName: string | null;
  totalPkr: number;
  amountDuePkr: number;
  amountOutstandingPkr: number;
  bankTransferReference: string | null;
  createdAt: string;
  latestReceipt: { id: string; uploadedAt: string; reviewStatus: string; contentType: string | null } | null;
  // Guest checkout — placed without signing in; the contact is what the buyer typed at checkout.
  placedAsGuest: boolean;
  guestContactName: string | null;
  guestContactWhatsapp: string | null;
}

// docs/specs/2026-08-28-08-orders-payment-processing.md (aspect A-013, AC-4/AC-5) — the bank-transfer
// receipt queue: every order still awaiting payment that has an uploaded receipt waiting for review
// (GET /api/orders?receiptStatus=pending, oldest first). "Review" opens the order, where the receipt
// itself is shown next to Confirm / Reject. PaymentMethodSetting stays editable on /settings/platform (AC-9).
export default function PaymentsPage() {
  const router = useRouter();
  const { user, accessToken, isReady } = useAuth();
  const [rows, setRows] = useState<QueueRow[] | null>(null);
  const [error, setError] = useState<ApiError | null>(null);

  const load = useCallback(async () => {
    if (!accessToken) return;
    setError(null);
    try {
      const list = await apiFetch<QueueRow[]>('/api/orders?receiptStatus=pending&page=1&pageSize=100', { headers: { Authorization: `Bearer ${accessToken}` } });
      setRows(list);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.error : { code: 'INTERNAL_ERROR', message: 'Failed to load the receipt queue.', traceId: '' });
    }
  }, [accessToken]);

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
      <div>
        <h1 className="font-display text-3xl font-bold text-navy-800">Payments</h1>
        <p className="mt-1 text-sm text-gray-500">Bank-transfer receipts awaiting review (the only payment method), and the bank account customers pay into.</p>
      </div>

      <ErrorBanner error={error} />

      <Card title="Bank-transfer receipts awaiting review" action={rows ? <Badge tone={rows.length > 0 ? 'warning' : 'neutral'}>{rows.length} pending</Badge> : undefined}>
        {rows === null && !error && <p className="text-sm text-gray-400">Loading…</p>}
        {rows && rows.length === 0 && <p className="text-sm text-gray-500">No receipts are waiting for review.</p>}
        {rows && rows.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="py-2 pr-4">Order</th>
                  <th className="py-2 pr-4">Customer</th>
                  <th className="py-2 pr-4">Reference</th>
                  <th className="py-2 pr-4">Outstanding to confirm</th>
                  <th className="py-2 pr-4">Receipt uploaded</th>
                  <th className="py-2 pr-4" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td className="py-2 pr-4 font-semibold">#{row.id}</td>
                    <td className="py-2 pr-4">
                      <div>
                        {(row.placedAsGuest ? row.guestContactName : null) ?? row.customerDisplayName ?? row.customerEmail}
                        {row.placedAsGuest && (
                          <span className="ml-2">
                            <Badge tone="neutral">Guest</Badge>
                          </span>
                        )}
                      </div>
                      {(row.placedAsGuest ? row.guestContactName : row.customerDisplayName) && <div className="text-xs text-gray-500">{row.customerEmail}</div>}
                      {row.placedAsGuest && row.guestContactWhatsapp && <div className="text-xs text-gray-500">WhatsApp: {row.guestContactWhatsapp}</div>}
                    </td>
                    <td className="py-2 pr-4 font-mono text-xs">{row.bankTransferReference ?? '—'}</td>
                    <td className="py-2 pr-4">PKR {row.amountOutstandingPkr}</td>
                    <td className="py-2 pr-4">
                      {row.latestReceipt ? new Date(row.latestReceipt.uploadedAt).toLocaleString() : '—'}
                      {row.latestReceipt?.contentType && <span className="ml-2 text-xs text-gray-400">{row.latestReceipt.contentType.replace('application/', '').replace('image/', '')}</span>}
                    </td>
                    <td className="py-2 pr-4 text-right">
                      <Link href={`/orders/${row.id}`} className="font-semibold text-navy-800 underline">
                        Review receipt
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card title="Bank account details">
        <p className="text-sm text-gray-500">
          Bank name, account title, account number, IBAN and payment instructions are edited in Settings (AC-9 — a change applies to the very next customer payment page, no deploy).
        </p>
        <Link href="/settings/platform" className="mt-2 inline-block text-sm font-semibold text-navy-800 underline">
          Edit bank details
        </Link>
      </Card>
    </div>
  );
}
