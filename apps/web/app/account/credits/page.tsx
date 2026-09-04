'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import type { ApiError } from '@czd/shared-types';
import { ApiClientError, apiFetch, apiFetchWithMeta } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { ErrorBanner, SuccessBanner } from '@/components/ErrorBanner';

interface CreditBalanceDto {
  available: number;
  used: number;
  total: number;
}

// Mirrors apps/api/src/credits/dto/credit-transaction.dto.ts's CreditTransactionDto.
interface CreditTransactionDto {
  id: string;
  type: 'purchase' | 'usage' | 'refund' | 'adjustment' | 'grant';
  amount: number;
  relatedOrderId: string | null;
  note: string | null;
  createdAt: string;
}

const TYPE_LABEL: Record<CreditTransactionDto['type'], string> = {
  purchase: 'Purchase',
  usage: 'Used',
  refund: 'Refund',
  adjustment: 'Adjustment',
  grant: 'Monthly grant',
};

const PAGE_SIZE = 20;

// docs/specs/2026-08-28-09-subscriptions-credits.md §5 — /account/credits: balance, transaction
// history (paged), gift form (AC-10).
export default function AccountCreditsPage() {
  const router = useRouter();
  const { user, accessToken, isReady } = useAuth();
  const [balance, setBalance] = useState<CreditBalanceDto | null>(null);
  const [transactions, setTransactions] = useState<CreditTransactionDto[] | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<ApiError | null>(null);

  const [recipientEmail, setRecipientEmail] = useState('');
  const [giftAmount, setGiftAmount] = useState('');
  const [giftError, setGiftError] = useState<ApiError | null>(null);
  const [giftSuccess, setGiftSuccess] = useState<string | null>(null);
  const [gifting, setGifting] = useState(false);

  const loadBalance = useCallback(async () => {
    if (!accessToken) return;
    try {
      const b = await apiFetch<CreditBalanceDto>('/api/credits/balance', { headers: { Authorization: `Bearer ${accessToken}` } });
      setBalance(b);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.error : { code: 'INTERNAL_ERROR', message: 'Could not load balance.', traceId: '' });
    }
  }, [accessToken]);

  const loadTransactions = useCallback(
    async (p: number) => {
      if (!accessToken) return;
      try {
        const res = await apiFetchWithMeta<CreditTransactionDto[]>(`/api/credits/transactions?page=${p}&pageSize=${PAGE_SIZE}`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        setTransactions(res.data);
        setTotal(res.meta?.total ?? res.data.length);
      } catch (err) {
        setError(err instanceof ApiClientError ? err.error : { code: 'INTERNAL_ERROR', message: 'Could not load transactions.', traceId: '' });
      }
    },
    [accessToken],
  );

  useEffect(() => {
    if (isReady && !user) router.replace('/login');
  }, [isReady, user, router]);

  useEffect(() => {
    if (!user || !accessToken) return;
    loadBalance();
    loadTransactions(page);
  }, [user, accessToken, page, loadBalance, loadTransactions]);

  async function onGift(e: React.FormEvent) {
    e.preventDefault();
    setGiftError(null);
    setGiftSuccess(null);
    const amount = Number(giftAmount);
    if (!recipientEmail.trim() || !amount || amount <= 0) return;
    setGifting(true);
    try {
      const updated = await apiFetch<CreditBalanceDto>('/api/credits/gift', {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ recipientEmail: recipientEmail.trim(), amount }),
      });
      setBalance(updated);
      setGiftSuccess(`Gifted ${amount} credits to ${recipientEmail.trim()}.`);
      setRecipientEmail('');
      setGiftAmount('');
      loadTransactions(1);
      setPage(1);
    } catch (err) {
      setGiftError(err instanceof ApiClientError ? err.error : { code: 'INTERNAL_ERROR', message: 'Gift failed.', traceId: '' });
    } finally {
      setGifting(false);
    }
  }

  if (!isReady || !user) return null;

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-brand-navy">My Credits</h1>
      </div>

      <ErrorBanner error={error} />

      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg border border-gray-200 bg-white p-4 text-center">
          <p className="text-2xl font-bold text-brand-navy">{balance?.available ?? '—'}</p>
          <p className="text-xs text-gray-500">Available</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4 text-center">
          <p className="text-2xl font-bold text-brand-navy">{balance?.used ?? '—'}</p>
          <p className="text-xs text-gray-500">Used</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4 text-center">
          <p className="text-2xl font-bold text-brand-navy">{balance?.total ?? '—'}</p>
          <p className="text-xs text-gray-500">Total</p>
        </div>
      </div>

      <Link href="/pricing" className="inline-block text-sm text-brand-navy underline">
        Buy more credits
      </Link>

      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-brand-navy">Gift credits</h2>
        <form onSubmit={onGift} className="mt-2 flex flex-col gap-2 sm:flex-row">
          <input
            type="email"
            value={recipientEmail}
            onChange={(e) => setRecipientEmail(e.target.value)}
            placeholder="Recipient email"
            required
            className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
          <input
            type="number"
            min={1}
            value={giftAmount}
            onChange={(e) => setGiftAmount(e.target.value)}
            placeholder="Amount"
            required
            className="w-28 rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
          <button
            type="submit"
            disabled={gifting}
            className="rounded-md bg-brand-gold px-4 py-2 text-sm font-semibold text-brand-navy disabled:opacity-50"
          >
            {gifting ? 'Sending…' : 'Gift'}
          </button>
        </form>
        <ErrorBanner error={giftError} />
        {giftSuccess && <div className="mt-2"><SuccessBanner message={giftSuccess} /></div>}
      </div>

      <div>
        <h2 className="mb-2 text-sm font-semibold text-brand-navy">Transaction history</h2>
        {transactions === null ? (
          <p className="text-center text-sm text-gray-500">Loading…</p>
        ) : transactions.length === 0 ? (
          <div className="rounded-md border border-gray-200 px-4 py-6 text-center text-sm text-gray-500">No transactions yet.</div>
        ) : (
          <>
            <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white">
              {transactions.map((tx) => (
                <li key={tx.id} className="flex items-center justify-between px-4 py-3 text-sm">
                  <div>
                    <p className="font-semibold text-brand-navy">{TYPE_LABEL[tx.type]}</p>
                    <p className="text-gray-500">
                      {new Date(tx.createdAt).toLocaleDateString()}
                      {tx.note ? ` · ${tx.note}` : ''}
                      {tx.relatedOrderId ? ` · Order #${tx.relatedOrderId}` : ''}
                    </p>
                  </div>
                  <p className={`font-semibold ${tx.amount >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                    {tx.amount >= 0 ? '+' : ''}
                    {tx.amount}
                  </p>
                </li>
              ))}
            </ul>
            {totalPages > 1 && (
              <div className="mt-3 flex items-center justify-between text-sm">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="rounded-md border border-gray-300 px-3 py-1.5 disabled:opacity-50"
                >
                  Previous
                </button>
                <span className="text-gray-500">
                  Page {page} of {totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="rounded-md border border-gray-300 px-3 py-1.5 disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
