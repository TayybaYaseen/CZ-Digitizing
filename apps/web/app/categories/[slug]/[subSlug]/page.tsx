'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { ApiError } from '@czd/shared-types';
import { ApiClientError, apiFetch, apiFetchWithMeta } from '@/lib/api-client';
import { DesignCard, type DesignSummaryDto } from '@/components/DesignCard';
import { ErrorBanner } from '@/components/ErrorBanner';

interface CategoryDto {
  id: string;
  name: string;
  slug: string;
}

interface SubcategoryDto {
  id: string;
  name: string;
  slug: string;
  parentCategoryId: string;
}

// docs/specs/2026-08-28-04-design-catalog-browsing.md AC-1 — `/categories/:slug/:subSlug`,
// resolving slug → id the same way the parent category page does (no dedicated by-slug endpoint).
export default function SubcategoryDesignsPage() {
  const params = useParams<{ slug: string; subSlug: string }>();
  const [category, setCategory] = useState<CategoryDto | null | undefined>(undefined);
  const [subcategory, setSubcategory] = useState<SubcategoryDto | null | undefined>(undefined);
  const [designs, setDesigns] = useState<DesignSummaryDto[] | null>(null);
  const [error, setError] = useState<ApiError | null>(null);

  useEffect(() => {
    apiFetch<CategoryDto[]>('/api/categories')
      .then(async (categories) => {
        const matchCategory = categories.find((c) => c.slug === params.slug) ?? null;
        setCategory(matchCategory);
        if (!matchCategory) return;

        const subs = await apiFetch<SubcategoryDto[]>(`/api/categories/${matchCategory.id}/subcategories`);
        const matchSub = subs.find((s) => s.slug === params.subSlug) ?? null;
        setSubcategory(matchSub);
        if (!matchSub) return;

        const { data } = await apiFetchWithMeta<DesignSummaryDto[]>(`/api/designs/subcategory/${matchSub.id}?pageSize=50`);
        setDesigns(data);
      })
      .catch((err) => setError(err instanceof ApiClientError ? err.error : { code: 'INTERNAL_ERROR', message: 'Failed to load subcategory.', traceId: '' }));
  }, [params.slug, params.subSlug]);

  if (error) return <ErrorBanner error={error} />;
  if (category === undefined || subcategory === undefined) {
    return <div className="mx-auto max-w-6xl"><div className="h-8 w-48 animate-pulse rounded bg-gray-100" /></div>;
  }
  if (category === null || subcategory === null) return <p className="text-sm text-gray-500">Subcategory not found.</p>;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <Link href={`/categories/${category.slug}`} className="text-sm text-brand-navy underline">
          {category.name}
        </Link>
        <h1 className="text-2xl font-bold">{subcategory.name}</h1>
      </div>
      {designs === null ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-72 animate-pulse rounded-lg bg-gray-100" />
          ))}
        </div>
      ) : designs.length === 0 ? (
        <p className="rounded-md border border-gray-200 px-4 py-6 text-center text-sm text-gray-500">No designs in this category yet.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {designs.map((design) => (
            <DesignCard key={design.id} design={design} />
          ))}
        </div>
      )}
    </div>
  );
}
