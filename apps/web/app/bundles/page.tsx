'use client';

import { useCallback, useEffect, useState } from 'react';
import type { ApiError } from '@czd/shared-types';
import { ApiClientError, apiFetch } from '@/lib/api-client';
import { BundleCard, type BundleSummaryDto } from '@/components/BundleCard';
import { ErrorBanner } from '@/components/ErrorBanner';

// docs/specs/2026-08-28-06-design-bundles.md §5 — Loading/Empty/Error/Success states, same
// skeleton/grid conventions as apps/web/app/designs/page.tsx.
export default function BundlesPage() {
  const [bundles, setBundles] = useState<BundleSummaryDto[] | null>(null);
  const [error, setError] = useState<ApiError | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const data = await apiFetch<BundleSummaryDto[]>('/api/bundles?pageSize=50');
      setBundles(data);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.error : { code: 'INTERNAL_ERROR', message: 'Failed to load bundles.', traceId: '' });
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Design Bundles</h1>
        <p className="mt-1 text-sm text-gray-600">Themed collections at a bundle price.</p>
      </div>

      <ErrorBanner error={error} />

      {bundles === null && !error ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-72 animate-pulse rounded-lg bg-gray-100" />
          ))}
        </div>
      ) : bundles && bundles.length === 0 ? (
        <p className="rounded-md border border-gray-200 px-4 py-6 text-center text-sm text-gray-500">No bundles available right now.</p>
      ) : (
        bundles && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {bundles.map((bundle) => (
              <BundleCard key={bundle.id} bundle={bundle} />
            ))}
          </div>
        )
      )}
    </div>
  );
}
