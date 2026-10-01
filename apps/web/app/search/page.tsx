'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import type { ApiError } from '@czd/shared-types';
import { ApiClientError, apiFetch } from '@/lib/api-client';
import { DesignCard, type DesignSummaryDto } from '@/components/DesignCard';
import { ErrorBanner } from '@/components/ErrorBanner';
import { clientError } from '@/i18n/api-errors';
import { useLocale } from '@/lib/locale-context';

// AC-6 — header search's "View All Results" destination. Postgres-backed for now (design name +
// tags); AC-10's Elasticsearch swap, and covering categories/services/blog/FAQ in one merged
// result set, are a documented follow-up — those content types don't have owning indexes wired
// in yet either.
export default function SearchPage() {
  return (
    <Suspense>
      <SearchResults />
    </Suspense>
  );
}

function SearchResults() {
  const searchParams = useSearchParams();
  const q = searchParams.get('q') ?? '';
  const { t } = useLocale();
  const [results, setResults] = useState<DesignSummaryDto[] | null>(null);
  const [error, setError] = useState<ApiError | null>(null);

  useEffect(() => {
    if (!q) {
      setResults([]);
      return;
    }
    setResults(null);
    apiFetch<DesignSummaryDto[]>(`/api/designs/search?q=${encodeURIComponent(q)}`)
      .then(setResults)
      .catch((err) => setError(err instanceof ApiClientError ? err.error : clientError('errors.searchFailed')));
  }, [q]);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <h1 className="text-2xl font-bold">{t('search.resultsFor', { q })}</h1>
      <ErrorBanner error={error} />
      {results === null && !error ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-72 animate-pulse rounded-lg bg-gray-100" />
          ))}
        </div>
      ) : results && results.length === 0 ? (
        <p className="rounded-md border border-gray-200 px-4 py-6 text-center text-sm text-gray-500">{t('search.noResults')}</p>
      ) : (
        results && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {results.map((design) => (
              <DesignCard key={design.id} design={design} />
            ))}
          </div>
        )
      )}
    </div>
  );
}
