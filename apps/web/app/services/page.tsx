'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { ApiError } from '@czd/shared-types';
import { ApiClientError, apiFetch } from '@/lib/api-client';
import { ErrorBanner } from '@/components/ErrorBanner';

interface ServiceSummaryDto {
  id: string;
  name: string;
  slug: string;
  type: 'embroidery_digitizing' | 'vector_art';
  description: string;
  visualImageUrl: string;
}
interface MainServiceDto extends ServiceSummaryDto {
  subServices: ServiceSummaryDto[];
}

// docs/specs/2026-08-29-17-services-module.md AC-1 — the two main services, each with a visual,
// short explanation, and a link to its detail page.
export default function ServicesPage() {
  const [services, setServices] = useState<MainServiceDto[] | null>(null);
  const [error, setError] = useState<ApiError | null>(null);

  useEffect(() => {
    apiFetch<MainServiceDto[]>('/api/services')
      .then(setServices)
      .catch((err) => setError(err instanceof ApiClientError ? err.error : { code: 'INTERNAL_ERROR', message: 'Could not load services.', traceId: '' }));
  }, []);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Services</h1>
        <p className="mt-1 text-sm text-gray-600">Embroidery Digitizing and Vector Art — pick a service to see sub-categories, pricing guidance, and a Get a Quote link.</p>
      </div>

      <ErrorBanner error={error} />

      {services === null ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {[1, 2].map((i) => (
            <div key={i} className="h-48 animate-pulse rounded-lg bg-gray-100" />
          ))}
        </div>
      ) : services.length === 0 ? (
        <div className="rounded-md border border-gray-200 px-4 py-6 text-center text-sm text-gray-500">No services published yet — check back soon.</div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {services.map((service) => (
            <Link key={service.id} href={`/services/${service.slug}`} className="block overflow-hidden rounded-lg border border-gray-200 bg-white hover:border-brand-navy">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={service.visualImageUrl} alt={service.name} className="h-40 w-full object-cover" />
              <div className="p-4">
                <h2 className="text-lg font-semibold">{service.name}</h2>
                <p className="mt-1 text-sm text-gray-600">{service.description}</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
