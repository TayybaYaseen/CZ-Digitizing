'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { ApiError, FaqDto } from '@czd/shared-types';
import { ApiClientError, apiFetch } from '@/lib/api-client';
import { ErrorBanner } from '@/components/ErrorBanner';

interface ServiceSummaryDto {
  id: string;
  name: string;
  slug: string;
  type: 'embroidery_digitizing' | 'vector_art';
  parentServiceId: string | null;
  description: string;
  visualImageUrl: string;
  sortOrder: number;
  isPublished: boolean;
}
interface ServiceDetailDto extends ServiceSummaryDto {
  applications: string;
  process: string;
  relatedFaqIds: string[];
  relatedDesignCategoryId: string | null;
  subServices?: ServiceSummaryDto[];
}

// docs/specs/2026-08-29-17-services-module.md §5 — shared detail view for both a main service
// (/services/[slug]) and a sub-service (/services/[slug]/[subSlug]); the API resolves both by the
// same flat GET /api/services/:slug (AC-2/AC-3/AC-5/AC-6/AC-7/AC-10).
export function ServiceDetail({ slug }: { slug: string }) {
  const [service, setService] = useState<ServiceDetailDto | null>(null);
  const [faqs, setFaqs] = useState<FaqDto[]>([]);
  const [categorySlug, setCategorySlug] = useState<string | null>(null);
  const [error, setError] = useState<ApiError | null>(null);

  useEffect(() => {
    setService(null);
    setError(null);
    apiFetch<ServiceDetailDto>(`/api/services/${slug}`)
      .then(setService)
      .catch((err) => setError(err instanceof ApiClientError ? err.error : { code: 'INTERNAL_ERROR', message: 'Could not load this service.', traceId: '' }));
  }, [slug]);

  // AC-6 — resolve relatedFaqIds into full FAQ rows for display.
  useEffect(() => {
    if (!service || service.relatedFaqIds.length === 0) {
      setFaqs([]);
      return;
    }
    Promise.all(service.relatedFaqIds.map((id) => apiFetch<FaqDto>(`/api/faqs/${id}`).catch(() => null)))
      .then((rows) => setFaqs(rows.filter((r): r is FaqDto => r !== null)))
      .catch(() => setFaqs([]));
  }, [service]);

  // AC-10 — resolve the related Design Catalog category's slug for a "browse pre-made" link.
  useEffect(() => {
    if (!service?.relatedDesignCategoryId) {
      setCategorySlug(null);
      return;
    }
    apiFetch<{ slug: string }>(`/api/categories/${service.relatedDesignCategoryId}`)
      .then((c) => setCategorySlug(c.slug))
      .catch(() => setCategorySlug(null));
  }, [service?.relatedDesignCategoryId]);

  if (error) {
    return (
      <div className="mx-auto max-w-2xl">
        <ErrorBanner error={error} />
      </div>
    );
  }

  if (!service) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <div className="h-8 w-1/2 animate-pulse rounded bg-gray-100" />
        <div className="h-64 animate-pulse rounded-lg bg-gray-100" />
      </div>
    );
  }

  return (
    <article className="mx-auto max-w-3xl space-y-8">
      <Link href={service.parentServiceId ? `/services/${service.type === 'embroidery_digitizing' ? 'embroidery-digitizing' : 'vector-art'}` : '/services'} className="text-sm text-brand-navy underline">
        ← {service.parentServiceId ? 'Back to service' : 'All services'}
      </Link>

      <div>
        <h1 className="text-2xl font-bold">{service.name}</h1>
        <p className="mt-2 text-sm text-gray-700">{service.description}</p>
      </div>

      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={service.visualImageUrl} alt={service.name} className="w-full rounded-lg object-cover" />

      {service.subServices && service.subServices.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold">Sub-categories</h2>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {service.subServices.map((sub) => (
              <Link key={sub.id} href={`/services/${service.slug}/${sub.slug}`} className="rounded-lg border border-gray-200 p-3 text-sm hover:border-brand-navy">
                {sub.name}
              </Link>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="text-lg font-semibold">Applications</h2>
        <p className="mt-2 text-sm text-gray-700">{service.applications}</p>
      </section>

      <section>
        <h2 className="text-lg font-semibold">Our process</h2>
        <p className="mt-2 text-sm text-gray-700">{service.process}</p>
      </section>

      {faqs.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold">FAQs</h2>
          <div className="mt-3 divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white">
            {faqs.map((f) => (
              <details key={f.id} className="px-4 py-3">
                <summary className="cursor-pointer list-none text-sm font-medium text-brand-navy">{f.question}</summary>
                <p className="mt-2 text-sm text-gray-700">{f.answer}</p>
              </details>
            ))}
          </div>
        </section>
      )}

      <div className="flex flex-wrap gap-3 border-t border-gray-100 pt-6">
        {/* AC-7 — pre-scoped entry point; A-016 (Smart Get a Quote) owns the actual quote flow and
            its Step 1 pre-fill once built, per spec AC-11's ownership boundary. */}
        <a
          href={`/get-a-quote?service=${service.slug}`}
          className="rounded-md bg-brand-gold px-4 py-2 text-sm font-semibold text-brand-navy hover:brightness-110"
        >
          Get a Quote
        </a>
        {categorySlug && (
          <Link href={`/categories/${categorySlug}`} className="rounded-md border border-gray-300 px-4 py-2 text-sm font-semibold text-brand-navy hover:bg-gray-50">
            Browse pre-made designs
          </Link>
        )}
      </div>
    </article>
  );
}
