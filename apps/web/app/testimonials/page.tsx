'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { ApiError, PublicTestimonialDto } from '@czd/shared-types';
import { ApiClientError, apiFetch } from '@/lib/api-client';
import { ErrorBanner } from '@/components/ErrorBanner';
import { TestimonialCard } from '@/components/TestimonialCard';
import { useLocale } from '@/lib/locale-context';
import { clientError } from '@/i18n/api-errors';

// docs/specs/2026-08-28-10-content-knowledge-base.md AC-4; A-026
// (docs/specs/2026-10-06-22-customer-review-submission.md §7/§14) adds the Write a Review CTA and the
// "No reviews yet" empty state.
export default function TestimonialsPage() {
  const { t } = useLocale();
  const [testimonials, setTestimonials] = useState<PublicTestimonialDto[] | null>(null);
  const [error, setError] = useState<ApiError | null>(null);

  useEffect(() => {
    apiFetch<PublicTestimonialDto[]>('/api/testimonials?scope=all')
      .then(setTestimonials)
      .catch((err) => setError(err instanceof ApiClientError ? err.error : clientError('errors.loadTestimonialsFailed')));
  }, []);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{t('testimonials.title')}</h1>
          <p className="mt-1 text-sm text-gray-600">{t('testimonials.subtitle')}</p>
        </div>
        <Link href="/testimonials/write" className="rounded-md bg-brand-gold px-4 py-2 text-sm font-semibold text-brand-navy" data-testid="write-review-cta">
          {t('reviews.writeReview')}
        </Link>
      </div>

      <ErrorBanner error={error} />

      {testimonials === null ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-32 animate-pulse rounded-md bg-gray-100" />
          ))}
        </div>
      ) : testimonials.length === 0 ? (
        error ? null : (
          <div className="rounded-lg border border-dashed border-gray-300 px-4 py-10 text-center">
            <p className="font-semibold text-brand-navy">{t('reviews.noReviewsYet')}</p>
            <p className="mt-1 text-sm text-gray-600">{t('reviews.noReviewsYetBody')}</p>
          </div>
        )
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {testimonials.map((item) => (
            <TestimonialCard key={item.id} t={item} />
          ))}
        </div>
      )}
    </div>
  );
}
