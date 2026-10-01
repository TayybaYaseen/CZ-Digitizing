'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { ApiError, QuoteDto } from '@czd/shared-types';
import { ApiClientError, apiFetch } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { ErrorBanner } from '@/components/ErrorBanner';
import { clientError } from '@/i18n/api-errors';
import { useLocale } from '@/lib/locale-context';

// Status labels live under `quoteStatus.<status>` in the locale files (i18n A-021).

// docs/specs/2026-08-28-11-smart-get-a-quote.md §5 — /account/quotes, GET /api/quotes/user/history.
export default function MyQuotesPage() {
  const router = useRouter();
  const { user, accessToken, isReady } = useAuth();
  const { t, tOr, formatDate } = useLocale();
  const [quotes, setQuotes] = useState<QuoteDto[] | null>(null);
  const [error, setError] = useState<ApiError | null>(null);

  useEffect(() => {
    if (isReady && !user) router.replace('/login');
  }, [isReady, user, router]);

  useEffect(() => {
    if (!user || !accessToken) return;
    apiFetch<QuoteDto[]>('/api/quotes/user/history', { headers: { Authorization: `Bearer ${accessToken}` } })
      .then(setQuotes)
      .catch((err) => setError(err instanceof ApiClientError ? err.error : clientError('errors.loadQuotesFailed')));
  }, [user, accessToken]);

  if (!isReady || !user) return null;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t('nav.myQuotes')}</h1>
        <p className="mt-1 text-sm text-gray-600">{t('quote.mySubtitle')}</p>
      </div>

      <ErrorBanner error={error} />

      {quotes === null ? (
        <p className="text-center text-sm text-gray-500">{t('common.loading')}</p>
      ) : quotes.length === 0 ? (
        <div className="rounded-md border border-gray-200 px-4 py-6 text-center text-sm text-gray-500">
          <p>{t('quote.none')}</p>
          <a href="/get-a-quote" className="mt-2 inline-block text-brand-navy underline">
            {t('nav.getAQuote')}
          </a>
        </div>
      ) : (
        <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white">
          {quotes.map((q) => (
            <li key={q.id} className="flex items-center justify-between px-4 py-3 text-sm">
              <div>
                <p className="font-medium">{t('quote.quoteId', { id: q.id })}</p>
                <p className="text-xs text-gray-500">{formatDate(q.createdAt)}</p>
              </div>
              <div className="text-end">
                <p className="font-medium">{tOr(`quoteStatus.${q.status}`, q.status)}</p>
                {q.quotedPricePkr && <p className="text-xs text-gray-500">PKR {q.quotedPricePkr}</p>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
