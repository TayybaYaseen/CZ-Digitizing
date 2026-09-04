'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { ApiError, PortfolioItemDto } from '@czd/shared-types';
import { ApiClientError, apiFetch } from '@/lib/api-client';
import { ErrorBanner } from '@/components/ErrorBanner';

// docs/specs/2026-08-28-10-content-knowledge-base.md AC-12 — Admin-defined order, detail view only
// when an item has more than one image (AC-17: text always renders as Admin entered it).
export default function PortfolioPage() {
  const [items, setItems] = useState<PortfolioItemDto[] | null>(null);
  const [error, setError] = useState<ApiError | null>(null);

  useEffect(() => {
    apiFetch<PortfolioItemDto[]>('/api/portfolio')
      .then(setItems)
      .catch((err) => setError(err instanceof ApiClientError ? err.error : { code: 'INTERNAL_ERROR', message: 'Could not load the portfolio.', traceId: '' }));
  }, []);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Portfolio</h1>
        <p className="mt-1 text-sm text-gray-600">A selection of our work.</p>
      </div>

      <ErrorBanner error={error} />

      {items === null ? (
        <div className="grid gap-4 sm:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="aspect-square animate-pulse rounded-md bg-gray-100" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <p className="text-center text-sm text-gray-500">No portfolio items yet.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-3">
          {items.map((item) => <PortfolioCard key={item.id} item={item} />)}
        </div>
      )}
    </div>
  );
}

function PortfolioCard({ item }: { item: PortfolioItemDto }) {
  const body = (
    <>
      {item.mediaUrls[0] && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={item.mediaUrls[0]} alt={item.title} className="aspect-square w-full object-cover" />
      )}
      <div className="p-2">
        <p className="text-sm font-semibold text-brand-navy">{item.title}</p>
        {item.description && <p className="text-xs text-gray-500 line-clamp-2">{item.description}</p>}
      </div>
    </>
  );

  return item.mediaUrls.length > 1 ? (
    <Link href={`/portfolio/${item.id}`} className="block overflow-hidden rounded-lg border border-gray-200 bg-white">
      {body}
    </Link>
  ) : (
    <div className="block overflow-hidden rounded-lg border border-gray-200 bg-white">{body}</div>
  );
}
