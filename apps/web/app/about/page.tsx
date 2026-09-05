'use client';

import { useEffect, useState } from 'react';
import type { AboutContentDto, ApiError } from '@czd/shared-types';
import { ApiClientError, apiFetch } from '@/lib/api-client';
import { ErrorBanner } from '@/components/ErrorBanner';

// docs/specs/2026-08-28-10-content-knowledge-base.md AC-11 — always-live, no publish step.
export default function AboutPage() {
  const [about, setAbout] = useState<AboutContentDto | null>(null);
  const [error, setError] = useState<ApiError | null>(null);

  useEffect(() => {
    apiFetch<AboutContentDto>('/api/about')
      .then(setAbout)
      .catch((err) => setError(err instanceof ApiClientError ? err.error : { code: 'INTERNAL_ERROR', message: 'Could not load About content.', traceId: '' }));
  }, []);

  if (error) {
    return (
      <div className="mx-auto max-w-2xl">
        <ErrorBanner error={error} />
      </div>
    );
  }

  if (!about) return <p className="text-center text-sm text-gray-500">Loading…</p>;

  return (
    <article className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">{about.heading}</h1>
      {about.imageUrls.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2">
          {about.imageUrls.map((url) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={url} src={url} alt="" className="rounded-lg object-cover" />
          ))}
        </div>
      )}
      <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: about.body }} />
    </article>
  );
}
