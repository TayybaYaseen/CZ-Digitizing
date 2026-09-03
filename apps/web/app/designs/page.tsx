'use client';

import { useCallback, useEffect, useState } from 'react';
import type { ApiError } from '@czd/shared-types';
import { ApiClientError, apiFetch, apiFetchWithMeta } from '@/lib/api-client';
import { DesignCard, type DesignSummaryDto } from '@/components/DesignCard';
import { ErrorBanner } from '@/components/ErrorBanner';

interface CategoryDto {
  id: string;
  name: string;
  slug: string;
}

// docs/specs/2026-08-28-04-design-catalog-browsing.md AC-7/AC-9 — All Designs with faceted
// filters (category, price range, tags, stitch-count range, thread-color) and pagination
// (limit 50, enforced server-side). Service-type filter renders disabled — Services (A-014) is
// still Blocked, so there's nothing yet for it to filter against.
export default function AllDesignsPage() {
  const [designs, setDesigns] = useState<DesignSummaryDto[] | null>(null);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<ApiError | null>(null);
  const [categories, setCategories] = useState<CategoryDto[]>([]);
  const [sort, setSort] = useState<'newest' | 'price_asc' | 'price_desc'>('newest');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [tags, setTags] = useState('');
  const [minStitchCount, setMinStitchCount] = useState('');
  const [maxStitchCount, setMaxStitchCount] = useState('');
  const [threadColorCount, setThreadColorCount] = useState('');

  useEffect(() => {
    apiFetch<CategoryDto[]>('/api/categories').then(setCategories).catch(() => setCategories([]));
  }, []);

  const load = useCallback(async () => {
    setError(null);
    try {
      const params = new URLSearchParams({ sort, pageSize: '50' });
      if (minPrice) params.set('minPricePkr', minPrice);
      if (maxPrice) params.set('maxPricePkr', maxPrice);
      if (categoryId) params.set('category', categoryId);
      if (tags.trim()) params.set('tags', tags.trim());
      if (minStitchCount) params.set('minStitchCount', minStitchCount);
      if (maxStitchCount) params.set('maxStitchCount', maxStitchCount);
      if (threadColorCount) params.set('threadColorCount', threadColorCount);
      const { data, meta } = await apiFetchWithMeta<DesignSummaryDto[]>(`/api/designs?${params.toString()}`);
      setDesigns(data);
      setTotal(meta?.total ?? data.length);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.error : { code: 'INTERNAL_ERROR', message: 'Failed to load designs.', traceId: '' });
    }
  }, [sort, minPrice, maxPrice, categoryId, tags, minStitchCount, maxStitchCount, threadColorCount]);

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
        <label className="text-sm text-gray-600">
          Category
          <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="ml-2 rounded-md border border-gray-300 px-2 py-1 text-sm">
            <option value="">All</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm text-gray-600">
          Tags
          <input
            type="text"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="floral,caps"
            className="ml-2 w-32 rounded-md border border-gray-300 px-2 py-1 text-sm"
          />
        </label>
        <label className="text-sm text-gray-600">
          Min stitches
          <input
            type="number"
            value={minStitchCount}
            onChange={(e) => setMinStitchCount(e.target.value)}
            className="ml-2 w-24 rounded-md border border-gray-300 px-2 py-1 text-sm"
          />
        </label>
        <label className="text-sm text-gray-600">
          Max stitches
          <input
            type="number"
            value={maxStitchCount}
            onChange={(e) => setMaxStitchCount(e.target.value)}
            className="ml-2 w-24 rounded-md border border-gray-300 px-2 py-1 text-sm"
          />
        </label>
        <label className="text-sm text-gray-600">
          Thread colors
          <input
            type="number"
            value={threadColorCount}
            onChange={(e) => setThreadColorCount(e.target.value)}
            className="ml-2 w-20 rounded-md border border-gray-300 px-2 py-1 text-sm"
          />
        </label>
        {/* TODO(A-014): Services doesn't exist yet — filter renders disabled until it does. */}
        <label className="text-sm text-gray-400">
          Service type
          <select disabled className="ml-2 rounded-md border border-gray-200 bg-gray-50 px-2 py-1 text-sm text-gray-400">
            <option>Coming soon</option>
          </select>
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
