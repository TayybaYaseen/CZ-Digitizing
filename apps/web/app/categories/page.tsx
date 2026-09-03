'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { ApiError } from '@czd/shared-types';
import { ApiClientError, apiFetch } from '@/lib/api-client';
import { ErrorBanner } from '@/components/ErrorBanner';

interface CategoryDto {
  id: string;
  name: string;
  slug: string;
}

// docs/specs/2026-08-28-04-design-catalog-browsing.md AC-1 — browse into a category from nav.
export default function CategoriesPage() {
  const [categories, setCategories] = useState<CategoryDto[] | null>(null);
  const [error, setError] = useState<ApiError | null>(null);

  useEffect(() => {
    apiFetch<CategoryDto[]>('/api/categories')
      .then(setCategories)
      .catch((err) => setError(err instanceof ApiClientError ? err.error : { code: 'INTERNAL_ERROR', message: 'Failed to load categories.', traceId: '' }));
  }, []);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <h1 className="text-2xl font-bold">Design Categories</h1>
      <ErrorBanner error={error} />
      {categories === null && !error ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-md bg-gray-100" />
          ))}
        </div>
      ) : categories && categories.length === 0 ? (
        <p className="text-sm text-gray-500">No categories yet.</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {categories?.map((category) => (
            <Link
              key={category.id}
              href={`/categories/${category.slug}`}
              className="flex items-center justify-center rounded-md border border-gray-200 px-4 py-6 text-center text-sm font-medium hover:border-brand-gold hover:text-brand-gold"
            >
              {category.name}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
