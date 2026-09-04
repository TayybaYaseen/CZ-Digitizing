'use client';

import { useEffect, useState } from 'react';
import type { ApiError, TestimonialDto } from '@czd/shared-types';
import { ApiClientError, apiFetch } from '@/lib/api-client';
import { ErrorBanner } from '@/components/ErrorBanner';

// docs/specs/2026-08-28-10-content-knowledge-base.md AC-4.
export default function TestimonialsPage() {
  const [testimonials, setTestimonials] = useState<TestimonialDto[] | null>(null);
  const [error, setError] = useState<ApiError | null>(null);

  useEffect(() => {
    apiFetch<TestimonialDto[]>('/api/testimonials?scope=all')
      .then(setTestimonials)
      .catch((err) => setError(err instanceof ApiClientError ? err.error : { code: 'INTERNAL_ERROR', message: 'Could not load testimonials.', traceId: '' }));
  }, []);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Customer Testimonials</h1>
        <p className="mt-1 text-sm text-gray-600">Real feedback from real customers.</p>
      </div>

      <ErrorBanner error={error} />

      {testimonials === null ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-32 animate-pulse rounded-md bg-gray-100" />
          ))}
        </div>
      ) : testimonials.length === 0 ? null : (
        <div className="grid gap-4 sm:grid-cols-2">
          {testimonials.map((t) => (
            <TestimonialCard key={t.id} t={t} />
          ))}
        </div>
      )}
    </div>
  );
}

export function TestimonialCard({ t }: { t: TestimonialDto }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="flex items-center gap-3">
        {t.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={t.photoUrl} alt={t.customerName} className="h-10 w-10 rounded-full object-cover" />
        ) : (
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gold-100 text-sm font-semibold text-gold-700">
            {t.customerName.charAt(0)}
          </div>
        )}
        <div>
          <p className="text-sm font-semibold text-brand-navy">{t.customerName}</p>
          <p className="text-xs text-gray-500">
            {t.country}
            {t.business ? ` · ${t.business}` : ''}
          </p>
        </div>
      </div>
      <p className="mt-2 text-xs text-gold-600">{'★'.repeat(t.rating)}{'☆'.repeat(5 - t.rating)}</p>
      <p className="mt-2 text-sm text-gray-700">{t.feedback}</p>
      <p className="mt-2 text-xs font-medium text-gray-400">{t.serviceUsed}</p>
    </div>
  );
}
