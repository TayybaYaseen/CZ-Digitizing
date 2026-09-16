'use client';

import { useEffect, useMemo, useState } from 'react';
import type { ApiError, PortfolioItemDto } from '@czd/shared-types';
import { ApiClientError, apiFetch } from '@/lib/api-client';
import { ErrorBanner } from '@/components/ErrorBanner';
import { PortfolioIdentityHero } from '@/components/portfolio/PortfolioIdentityHero';
import { PortfolioProfile } from '@/components/portfolio/PortfolioProfile';
import { PortfolioCoreExpertise } from '@/components/portfolio/PortfolioCoreExpertise';
import { PortfolioSoftwareExpertise } from '@/components/portfolio/PortfolioSoftwareExpertise';
import { PortfolioExperience } from '@/components/portfolio/PortfolioExperience';
import { PortfolioTextileExpertise } from '@/components/portfolio/PortfolioTextileExpertise';
import { PortfolioAuditExpertise } from '@/components/portfolio/PortfolioAuditExpertise';
import { PortfolioSkills } from '@/components/portfolio/PortfolioSkills';
import { PortfolioEducation } from '@/components/portfolio/PortfolioEducation';
import { PortfolioAdditionalExperience } from '@/components/portfolio/PortfolioAdditionalExperience';
import { PortfolioCategoryFilter } from '@/components/portfolio/PortfolioCategoryFilter';
import { PortfolioCard } from '@/components/portfolio/PortfolioCard';
import { PortfolioCta } from '@/components/portfolio/PortfolioCta';
import { PortfolioSectionHeading } from '@/components/portfolio/PortfolioSectionHeading';

// docs/portfolio-spec.md §5 — final 12-section order (business-owner approved 2026-09-16):
// Hero → Profile → Core Embroidery Expertise → Software Expertise → Professional Experience →
// Textile & Sourcing Expertise → Internal Audit Expertise → Key Skills → Education →
// Earlier/Additional Experience → Real Portfolio Work Samples → Professional CTA.
export default function PortfolioPage() {
  const [items, setItems] = useState<PortfolioItemDto[] | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [category, setCategory] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<PortfolioItemDto[]>('/api/portfolio')
      .then(setItems)
      .catch((err) => setError(err instanceof ApiClientError ? err.error : { code: 'INTERNAL_ERROR', message: 'Could not load the portfolio.', traceId: '' }));
  }, []);

  const categories = useMemo(() => {
    if (!items) return [];
    return Array.from(new Set(items.map((i) => i.category).filter((c): c is string => !!c))).sort();
  }, [items]);

  const visibleItems = useMemo(() => {
    if (!items) return null;
    return category ? items.filter((i) => i.category === category) : items;
  }, [items, category]);

  return (
    <div className="space-y-16 sm:space-y-20">
      <PortfolioIdentityHero />
      <PortfolioProfile />
      <PortfolioCoreExpertise />
      <PortfolioSoftwareExpertise />
      <PortfolioExperience />
      <PortfolioTextileExpertise />
      <PortfolioAuditExpertise />
      <PortfolioSkills />
      <PortfolioEducation />
      <PortfolioAdditionalExperience />

      {/* Real Portfolio Work Samples — the only admin-authored section on the page (§5.11). */}
      <section className="mx-auto max-w-6xl px-1">
        <PortfolioSectionHeading eyebrow="Real Work" title="Portfolio Work Samples" weight="primary" />

        <ErrorBanner error={error} />

        {items !== null && <PortfolioCategoryFilter categories={categories} selected={category} onSelect={setCategory} />}

        {items === null ? (
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="aspect-[4/3] animate-pulse rounded-card bg-gray-100" />
            ))}
          </div>
        ) : visibleItems && visibleItems.length === 0 ? (
          <p className="mt-6 rounded-card border border-gray-200 bg-white px-4 py-10 text-center text-sm text-gray-500">
            No portfolio items yet — check back soon.
          </p>
        ) : (
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {visibleItems?.map((item) => (
              <PortfolioCard key={item.id} item={item} />
            ))}
          </div>
        )}
      </section>

      <PortfolioCta />
    </div>
  );
}
