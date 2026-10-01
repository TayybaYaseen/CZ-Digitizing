'use client';

import { useEffect, useMemo, useState } from 'react';
import type { ApiError, PortfolioItemDto } from '@czd/shared-types';
import { ApiClientError, apiFetch } from '@/lib/api-client';
import { ErrorBanner } from '@/components/ErrorBanner';
import { useLocale } from '@/lib/locale-context';
import { PortfolioIdentityHero } from '@/components/portfolio/PortfolioIdentityHero';
import { PortfolioProfile } from '@/components/portfolio/PortfolioProfile';
import { PortfolioCoreExpertise } from '@/components/portfolio/PortfolioCoreExpertise';
import { PortfolioSoftwareExpertise } from '@/components/portfolio/PortfolioSoftwareExpertise';
import { PortfolioExperience } from '@/components/portfolio/PortfolioExperience';
import { PortfolioSkills } from '@/components/portfolio/PortfolioSkills';
import { PortfolioEducation } from '@/components/portfolio/PortfolioEducation';
import { PortfolioCategoryFilter } from '@/components/portfolio/PortfolioCategoryFilter';
import { PortfolioCard } from '@/components/portfolio/PortfolioCard';
import { PortfolioCta } from '@/components/portfolio/PortfolioCta';
import { PortfolioSectionHeading } from '@/components/portfolio/PortfolioSectionHeading';
import { clientError } from '@/i18n/api-errors';

// docs/portfolio-spec.md §5 — section order, revised 2026-09-18/2026-09-28 (business-owner
// decisions): Hero → Profile → Core Embroidery Expertise → Software Expertise → Professional
// Experience (single consolidated Freelancer entry, no employer names/responsibilities) → Key
// Skills → Education → Real Portfolio Work Samples → Professional CTA. The Earlier/Additional
// Experience, Textile & Sourcing Expertise, and Internal Audit/Operational Expertise sections are
// all removed — no employer name or per-employer responsibility list appears anywhere on the page.
//
// The "Home Page Logos" title is a reserved, exact-match title (case-insensitive): an admin work
// sample created with this title is pinned as the last Work Samples card regardless of category
// filter or sort order, and its gallery images are used to hold every logo the admin wants shown
// there — clicking it opens the existing detail page, which already renders every gallery image
// as a thumbnail grid with lightbox navigation (no separate "logos" model needed).
const HOME_PAGE_LOGOS_TITLE = 'home page logos';

export default function PortfolioPage() {
  const { t } = useLocale();
  const [items, setItems] = useState<PortfolioItemDto[] | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [category, setCategory] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<PortfolioItemDto[]>('/api/portfolio')
      .then(setItems)
      .catch((err) => setError(err instanceof ApiClientError ? err.error : clientError('errors.loadPortfolioFailed')));
  }, []);

  const logosItem = useMemo(() => {
    if (!items) return null;
    return items.find((i) => i.title.trim().toLowerCase() === HOME_PAGE_LOGOS_TITLE) ?? null;
  }, [items]);

  const categories = useMemo(() => {
    if (!items) return [];
    return Array.from(new Set(items.filter((i) => i !== logosItem).map((i) => i.category).filter((c): c is string => !!c))).sort();
  }, [items, logosItem]);

  const visibleItems = useMemo(() => {
    if (!items) return null;
    const rest = items.filter((i) => i !== logosItem);
    return category ? rest.filter((i) => i.category === category) : rest;
  }, [items, category, logosItem]);

  const hasNoResults = visibleItems && visibleItems.length === 0 && !logosItem;

  return (
    <div className="space-y-16 sm:space-y-20">
      <PortfolioIdentityHero />
      <PortfolioProfile />
      <PortfolioCoreExpertise />
      <PortfolioSoftwareExpertise />
      <PortfolioExperience />
      <PortfolioSkills />
      <PortfolioEducation />

      {/* Real Portfolio Work Samples — the only admin-authored section on the page (§5.11). */}
      <section className="mx-auto max-w-6xl px-1">
        <PortfolioSectionHeading eyebrow={t('portfolio.workEyebrow')} title={t('portfolio.workTitle')} weight="primary" />

        <ErrorBanner error={error} />

        {items !== null && <PortfolioCategoryFilter categories={categories} selected={category} onSelect={setCategory} />}

        {items === null ? (
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="aspect-[4/3] animate-pulse rounded-card bg-gray-100" />
            ))}
          </div>
        ) : hasNoResults ? (
          <p className="mt-6 rounded-card border border-gray-200 bg-white px-4 py-10 text-center text-sm text-gray-500">
            {t('portfolio.empty')}
          </p>
        ) : (
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {visibleItems?.map((item) => (
              <PortfolioCard key={item.id} item={item} />
            ))}
            {logosItem && <PortfolioCard key={logosItem.id} item={logosItem} />}
          </div>
        )}
      </section>

      <PortfolioCta />
    </div>
  );
}
