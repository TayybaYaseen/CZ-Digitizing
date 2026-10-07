'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { PublicTestimonialDto } from '@czd/shared-types';
import { apiFetch } from '@/lib/api-client';
import { useLocale } from '@/lib/locale-context';
import { TestimonialCard } from '@/components/TestimonialCard';

// docs/specs/2026-08-28-10-content-knowledge-base.md AC-4 — Home page, max 6, with View More.
// Zero testimonials hides the section entirely (spec §5 empty state), no placeholder.
// A-026 §7 adds the "Share your experience" entry point next to View More.
export function HomeTestimonials() {
  const { t } = useLocale();
  const [testimonials, setTestimonials] = useState<PublicTestimonialDto[]>([]);

  useEffect(() => {
    apiFetch<PublicTestimonialDto[]>('/api/testimonials?scope=home').then(setTestimonials).catch(() => setTestimonials([]));
  }, []);

  if (testimonials.length === 0) return null;

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <h2 className="text-lg font-bold">{t('home.testimonialsTitle')}</h2>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <Link href="/testimonials/write" className="text-sm font-semibold text-brand-navy underline">
            {t('reviews.shareExperienceLink')}
          </Link>
          <Link href="/testimonials" className="text-sm text-brand-navy underline">
            {t('common.viewMore')}
          </Link>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {testimonials.map((item) => (
          <TestimonialCard key={item.id} t={item} />
        ))}
      </div>
    </section>
  );
}
