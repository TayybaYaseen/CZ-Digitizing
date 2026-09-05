'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { ApiError, TipDto } from '@czd/shared-types';
import { ApiClientError, apiFetchWithMeta } from '@/lib/api-client';
import { ErrorBanner } from '@/components/ErrorBanner';

// docs/specs/2026-08-28-10-content-knowledge-base.md AC-3.
export default function TipsPage() {
  const [tips, setTips] = useState<TipDto[] | null>(null);
  const [error, setError] = useState<ApiError | null>(null);

  useEffect(() => {
    apiFetchWithMeta<TipDto[]>('/api/tips')
      .then((res) => setTips(res.data))
      .catch((err) => setError(err instanceof ApiClientError ? err.error : { code: 'INTERNAL_ERROR', message: 'Could not load tips.', traceId: '' }));
  }, []);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Tips for Embroiderers</h1>
        <p className="mt-1 text-sm text-gray-600">Embroidery-education articles from the CZ Digitizing team.</p>
      </div>

      <ErrorBanner error={error} />

      {tips === null ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 animate-pulse rounded-md bg-gray-100" />
          ))}
        </div>
      ) : tips.length === 0 ? (
        <p className="text-center text-sm text-gray-500">No tips published yet.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {tips.map((t) => (
            <Link key={t.id} href={`/tips/${t.id}`} className="rounded-lg border border-gray-200 bg-white p-4 hover:border-gold-400">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{t.category}</p>
              <h2 className="mt-1 font-semibold text-brand-navy">{t.title}</h2>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
