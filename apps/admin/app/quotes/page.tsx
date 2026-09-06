'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import type { ApiError } from '@czd/shared-types';
import { ApiClientError, apiFetch } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { ErrorBanner, SuccessBanner } from '@/components/ErrorBanner';
import { inputClass } from '@/components/FormField';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';

// Mirrors packages/shared-types/src/quotes.ts.
interface QuoteDto {
  id: string;
  name: string;
  email: string;
  whatsapp: string | null;
  country: string | null;
  serviceId: string;
  designUploadPath: string | null;
  size: string | null;
  quantity: number | null;
  fabric: string | null;
  threadColors: string | null;
  formatPreference: string | null;
  deadline: string | null;
  instructions: string | null;
  status: 'new' | 'responded' | 'converted_to_order';
  suggestedPricePkr: string | null;
  quotedPricePkr: string | null;
  adminNotes: string | null;
  orderId: string | null;
  createdAt: string;
}

const STATUS_TABS: { value: '' | QuoteDto['status']; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'new', label: 'New' },
  { value: 'responded', label: 'Responded' },
  { value: 'converted_to_order', label: 'Converted' },
];

// docs/specs/2026-08-28-11-smart-get-a-quote.md AC-4/AC-6/AC-7/AC-8 — admin quote inbox.
export default function QuotesAdminPage() {
  const router = useRouter();
  const { user, accessToken, isReady } = useAuth();
  const [quotes, setQuotes] = useState<QuoteDto[] | null>(null);
  const [statusFilter, setStatusFilter] = useState<'' | QuoteDto['status']>('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [price, setPrice] = useState('');
  const [notes, setNotes] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'bank_transfer' | 'paypal' | 'stripe'>('bank_transfer');
  const [listError, setListError] = useState<ApiError | null>(null);
  const [actionError, setActionError] = useState<ApiError | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!accessToken) return;
    setListError(null);
    try {
      const query = statusFilter ? `?status=${statusFilter}` : '';
      const list = await apiFetch<QuoteDto[]>(`/api/quotes${query}`, { headers: { Authorization: `Bearer ${accessToken}` } });
      setQuotes(list);
    } catch (err) {
      setListError(err instanceof ApiClientError ? err.error : { code: 'INTERNAL_ERROR', message: 'Failed to load quotes.', traceId: '' });
    }
  }, [accessToken, statusFilter]);

  useEffect(() => {
    if (!isReady) return;
    if (!user) {
      router.replace('/login');
      return;
    }
    load();
  }, [isReady, user, load, router]);

  function expand(quote: QuoteDto) {
    setExpanded(expanded === quote.id ? null : quote.id);
    setPrice(quote.quotedPricePkr ?? quote.suggestedPricePkr ?? '');
    setNotes(quote.adminNotes ?? '');
    setActionError(null);
  }

  async function onSuggestPrice(id: string) {
    setActionError(null);
    try {
      const updated = await apiFetch<QuoteDto>(`/api/quotes/${id}/suggest-price`, { method: 'POST', headers: { Authorization: `Bearer ${accessToken}` } });
      setPrice(updated.suggestedPricePkr ?? '');
      setQuotes((prev) => prev?.map((q) => (q.id === id ? updated : q)) ?? null);
    } catch (err) {
      setActionError(err instanceof ApiClientError ? err.error : { code: 'INTERNAL_ERROR', message: 'Failed to suggest a price.', traceId: '' });
    }
  }

  async function onRespond(id: string) {
    setActionError(null);
    try {
      await apiFetch(`/api/quotes/${id}/respond`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ quotedPricePkr: price, adminNotes: notes }),
      });
      setSuccessMessage(`Response sent for quote #${id}.`);
      load();
    } catch (err) {
      setActionError(err instanceof ApiClientError ? err.error : { code: 'INTERNAL_ERROR', message: 'Failed to respond.', traceId: '' });
    }
  }

  async function onConvert(id: string) {
    setActionError(null);
    try {
      const order = await apiFetch<{ id: string }>(`/api/quotes/${id}/convert`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ paymentMethod }),
      });
      setSuccessMessage(`Quote #${id} converted to order #${order.id}.`);
      load();
    } catch (err) {
      setActionError(err instanceof ApiClientError ? err.error : { code: 'INTERNAL_ERROR', message: 'Failed to convert to an order.', traceId: '' });
    }
  }

  if (!isReady || !user) return null;

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold text-navy-800">Quotes</h1>
        <p className="mt-1 text-sm text-gray-500">Submitted quote requests. Suggest a price, respond, and convert to an order.</p>
      </div>

      <div className="flex gap-2">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setStatusFilter(tab.value)}
            className={`rounded-md px-3 py-1.5 text-xs font-medium ${statusFilter === tab.value ? 'bg-gold-500 text-navy-800' : 'bg-gray-100 text-gray-600'}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <ErrorBanner error={listError} />
      {successMessage && <SuccessBanner message={successMessage} />}
      <ErrorBanner error={actionError} />

      <Card padding="p-0">
        {quotes === null ? (
          <p className="p-4 text-sm text-gray-400">Loading…</p>
        ) : quotes.length === 0 ? (
          <p className="p-4 text-sm text-gray-400">No quotes yet.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {quotes.map((quote) => (
              <li key={quote.id} className="p-3">
                <button onClick={() => expand(quote)} className="flex w-full items-center justify-between text-left text-sm">
                  <span className="font-medium text-navy-800">
                    #{quote.id} — {quote.name || quote.email} <span className="text-gray-400">({new Date(quote.createdAt).toLocaleDateString()})</span>
                  </span>
                  <span className="text-xs uppercase tracking-wide text-gray-500">{quote.status}</span>
                </button>

                {expanded === quote.id && (
                  <div className="mt-3 space-y-3 border-t border-gray-100 pt-3 text-xs text-gray-700">
                    <div className="grid grid-cols-2 gap-2">
                      <p>Email: {quote.email}</p>
                      <p>WhatsApp: {quote.whatsapp ?? '—'}</p>
                      <p>Country: {quote.country ?? '—'}</p>
                      <p>Size: {quote.size ?? '—'}</p>
                      <p>Quantity: {quote.quantity ?? '—'}</p>
                      <p>Fabric: {quote.fabric ?? '—'}</p>
                      <p>Thread colors: {quote.threadColors ?? '—'}</p>
                      <p>Format preference: {quote.formatPreference ?? '—'}</p>
                      <p>Deadline: {quote.deadline ? new Date(quote.deadline).toLocaleDateString() : '—'}</p>
                    </div>
                    {quote.instructions && <p>Instructions: {quote.instructions}</p>}
                    {quote.designUploadPath && <p>Design reference uploaded.</p>}

                    {quote.status !== 'converted_to_order' && (
                      <div className="space-y-2 rounded-md bg-gray-50 p-3">
                        <div className="flex items-center gap-2">
                          <input value={price} onChange={(e) => setPrice(e.target.value)} placeholder="Quoted price (PKR)" className={`${inputClass} text-xs`} />
                          <Button size="sm" variant="outlineNavy" onClick={() => onSuggestPrice(quote.id)}>
                            Suggest price
                          </Button>
                        </div>
                        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Admin notes" className={`${inputClass} text-xs`} rows={2} />
                        <Button size="sm" onClick={() => onRespond(quote.id)}>
                          Send response
                        </Button>
                      </div>
                    )}

                    {quote.status === 'responded' && (
                      <div className="flex items-center gap-2 rounded-md bg-gray-50 p-3">
                        <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value as typeof paymentMethod)} className={`${inputClass} text-xs`}>
                          <option value="bank_transfer">Bank transfer</option>
                          <option value="paypal">PayPal</option>
                          <option value="stripe">Stripe</option>
                        </select>
                        <Button size="sm" onClick={() => onConvert(quote.id)}>
                          Convert to order
                        </Button>
                      </div>
                    )}

                    {quote.status === 'converted_to_order' && <p className="font-medium text-emerald-700">Converted to order #{quote.orderId}</p>}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
