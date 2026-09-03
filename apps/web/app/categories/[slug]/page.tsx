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

// AC-1 — browsing into a category shows every design assigned to it, and lists any subcategories
// so a customer can drill further in. Routes are slug-based (spec §5) but the designs endpoint is
// id-based, so this resolves slug → id first via the categories list (no dedicated "get by slug"
// endpoint exists — small enough list not to need one).
export default function CategoryDesignsPage() {
  const params = useParams<{ slug: string }>();
  const [category, setCategory] = useState<CategoryDto | null | undefined>(undefined);
  const [subcategories, setSubcategories] = useState<SubcategoryDto[]>([]);
  const [designs, setDesigns] = useState<DesignSummaryDto[] | null>(null);
  const [error, setError] = useState<ApiError | null>(null);

  useEffect(() => {
    apiFetch<CategoryDto[]>('/api/categories')
      .then((categories) => {
        const match = categories.find((c) => c.slug === params.slug) ?? null;
        setCategory(match);
        if (!match) return;
        return Promise.all([
          apiFetchWithMeta<DesignSummaryDto[]>(`/api/designs/category/${match.id}?pageSize=50`).then(({ data }) => setDesigns(data)),
          apiFetch<SubcategoryDto[]>(`/api/categories/${match.id}/subcategories`).then(setSubcategories),
        ]);
      })
      .catch((err) => setError(err instanceof ApiClientError ? err.error : { code: 'INTERNAL_ERROR', message: 'Failed to load category.', traceId: '' }));
  }, [params.slug]);

  if (error) return <ErrorBanner error={error} />;
  if (category === undefined) return <div className="mx-auto max-w-6xl"><div className="h-8 w-48 animate-pulse rounded bg-gray-100" /></div>;
  if (category === null) return <p className="text-sm text-gray-500">Category not found.</p>;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <h1 className="text-2xl font-bold">{category.name}</h1>
      {subcategories.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {subcategories.map((sub) => (
            <Link
              key={sub.id}
              href={`/categories/${category.slug}/${sub.slug}`}
              className="rounded-full border border-gray-200 px-3 py-1 text-xs font-medium hover:border-brand-gold hover:text-brand-gold"
            >
              {sub.name}
            </Link>
          ))}
        </div>
      )}
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
