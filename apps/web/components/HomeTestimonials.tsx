'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { TestimonialDto } from '@czd/shared-types';
import { apiFetch } from '@/lib/api-client';
import { TestimonialCard } from '@/app/testimonials/page';

// docs/specs/2026-08-28-10-content-knowledge-base.md AC-4 — Home page, max 6, with View More.
// Zero testimonials hides the section entirely (spec §5 empty state), no placeholder.
export function HomeTestimonials() {
  const [testimonials, setTestimonials] = useState<TestimonialDto[]>([]);

  useEffect(() => {
    apiFetch<TestimonialDto[]>('/api/testimonials?scope=home').then(setTestimonials).catch(() => setTestimonials([]));
  }, []);

  if (testimonials.length === 0) return null;

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">What our customers say</h2>
        <Link href="/testimonials" className="text-sm text-brand-navy underline">
          View More
        </Link>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {testimonials.map((t) => (
          <TestimonialCard key={t.id} t={t} />
        ))}
      </div>
    </section>
  );
}
