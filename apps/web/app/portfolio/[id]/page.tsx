'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { ApiError, PortfolioItemDto } from '@czd/shared-types';
import { ApiClientError, apiFetch } from '@/lib/api-client';
import { ErrorBanner } from '@/components/ErrorBanner';

export default function PortfolioDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [item, setItem] = useState<PortfolioItemDto | null>(null);
  const [error, setError] = useState<ApiError | null>(null);

  useEffect(() => {
    apiFetch<PortfolioItemDto>(`/api/portfolio/${id}`)
      .then(setItem)
      .catch((err) => setError(err instanceof ApiClientError ? err.error : { code: 'INTERNAL_ERROR', message: 'Could not load this item.', traceId: '' }));
  }, [id]);

  if (error) {
    return (
      <div className="mx-auto max-w-2xl">
        <ErrorBanner error={error} />
      </div>
    );
  }

  if (!item) return <p className="text-center text-sm text-gray-500">Loading…</p>;

  return (
    <article className="mx-auto max-w-2xl space-y-6">
      <Link href="/portfolio" className="text-sm text-brand-navy underline">
        ← Portfolio
      </Link>
      <div>
        <h1 className="text-2xl font-bold">{item.title}</h1>
        {item.description && <p className="mt-2 text-sm text-gray-700">{item.description}</p>}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {item.mediaUrls.map((url) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={url} src={url} alt={item.title} className="rounded-lg object-cover" />
        ))}
      </div>
    </article>
  );
}
