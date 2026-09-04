'use client';

import { useEffect, useState } from 'react';
import type { ApiError, TestimonialDto } from '@czd/shared-types';
import { ApiClientError, apiFetch } from '@/lib/api-client';
import { ErrorBanner } from '@/components/ErrorBanner';
import { TestimonialCard } from '@/components/TestimonialCard';

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
