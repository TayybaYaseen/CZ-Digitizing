'use client';

import { useCallback, useEffect, useState } from 'react';
import type { ApiError } from '@czd/shared-types';
import { ApiClientError, apiFetchWithMeta } from '@/lib/api-client';
import { DesignCard, type DesignSummaryDto } from '@/components/DesignCard';
import { ErrorBanner } from '@/components/ErrorBanner';

// docs/specs/2026-08-28-04-design-catalog-browsing.md AC-7/AC-9 — All Designs with faceted
// filters (category/price/tags deferred to a follow-up: this pass wires price range and sort,
// the ones with the simplest, least ambiguous UI) and pagination (limit 50, enforced server-side).
export default function AllDesignsPage() {
  const [designs, setDesigns] = useState<DesignSummaryDto[] | null>(null);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<ApiError | null>(null);
  const [sort, setSort] = useState<'newest' | 'price_asc' | 'price_desc'>('newest');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');

  const load = useCallback(async () => {
    setError(null);
    try {
      const params = new URLSearchParams({ sort, pageSize: '50' });
      if (minPrice) params.set('minPricePkr', minPrice);
      if (maxPrice) params.set('maxPricePkr', maxPrice);
      const { data, meta } = await apiFetchWithMeta<DesignSummaryDto[]>(`/api/designs?${params.toString()}`);
      setDesigns(data);
      setTotal(meta?.total ?? data.length);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.error : { code: 'INTERNAL_ERROR', message: 'Failed to load designs.', traceId: '' });
    }
  }, [sort, minPrice, maxPrice]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">All Designs</h1>
        <p className="mt-1 text-sm text-gray-600">{total} design{total === 1 ? '' : 's'}</p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm text-gray-600">
          Sort
          <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} className="ml-2 rounded-md border border-gray-300 px-2 py-1 text-sm">
            <option value="newest">Newest</option>
            <option value="price_asc">Price: low to high</option>
            <option value="price_desc">Price: high to low</option>
          </select>
        </label>
        <label className="text-sm text-gray-600">
          Min price
          <input type="number" value={minPrice} onChange={(e) => setMinPrice(e.target.value)} className="ml-2 w-24 rounded-md border border-gray-300 px-2 py-1 text-sm" />
        </label>
        <label className="text-sm text-gray-600">
          Max price
          <input type="number" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} className="ml-2 w-24 rounded-md border border-gray-300 px-2 py-1 text-sm" />
        </label>
      </div>

      <ErrorBanner error={error} />

      {designs === null && !error ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-72 animate-pulse rounded-lg bg-gray-100" />
          ))}
        </div>
      ) : designs && designs.length === 0 ? (
        <p className="rounded-md border border-gray-200 px-4 py-6 text-center text-sm text-gray-500">No designs in this category yet.</p>
      ) : (
        designs && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {designs.map((design) => (
              <DesignCard key={design.id} design={design} />
            ))}
          </div>
        )
      )}
    </div>
  );
}
