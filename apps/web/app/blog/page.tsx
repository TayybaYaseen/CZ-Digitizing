'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import type { ApiError, BlogPostSummaryDto } from '@czd/shared-types';
import { ApiClientError, apiFetchWithMeta } from '@/lib/api-client';
import { ErrorBanner } from '@/components/ErrorBanner';
import { useLocale } from '@/lib/locale-context';
import { clientError } from '@/i18n/api-errors';

// docs/specs/2026-08-28-10-content-knowledge-base.md AC-9/AC-10 — newest first, category filter.
export default function BlogPage() {
  const { t, formatDate } = useLocale();
  const [posts, setPosts] = useState<BlogPostSummaryDto[] | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [category, setCategory] = useState<string | null>(null);

  useEffect(() => {
    apiFetchWithMeta<BlogPostSummaryDto[]>('/api/blog')
      .then((res) => setPosts(res.data))
      .catch((err) => setError(err instanceof ApiClientError ? err.error : clientError('errors.loadBlogFailed')));
  }, []);

  const categories = useMemo(() => Array.from(new Set((posts ?? []).map((p) => p.category))), [posts]);
  const visible = (posts ?? []).filter((p) => !category || p.category === category);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t('nav.blog')}</h1>
        <p className="mt-1 text-sm text-gray-600">{t('blog.subtitle')}</p>
      </div>

      <ErrorBanner error={error} />

      {categories.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setCategory(null)}
            className={`rounded-full border px-3 py-1 text-xs ${!category ? 'border-gold-500 bg-gold-50 text-gold-700' : 'border-gray-300 text-gray-600'}`}
          >
            {t('common.all')}
          </button>
          {categories.map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={`rounded-full border px-3 py-1 text-xs ${category === c ? 'border-gold-500 bg-gold-50 text-gold-700' : 'border-gray-300 text-gray-600'}`}
            >
              {c}
            </button>
          ))}
        </div>
      )}

      {posts === null ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-md bg-gray-100" />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <p className="text-center text-sm text-gray-500">{t('blog.empty')}</p>
      ) : (
        <div className="space-y-4">
          {visible.map((p) => (
            <Link key={p.id} href={`/blog/${p.slug}`} className="block rounded-lg border border-gray-200 bg-white p-4 hover:border-gold-400">
              {p.coverImageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.coverImageUrl} alt={p.title} className="mb-3 h-40 w-full rounded object-cover" />
              )}
              <p dir="auto" className="text-xs font-semibold uppercase tracking-wide text-gray-500">{p.category}</p>
              <h2 dir="auto" className="mt-1 text-lg font-semibold text-brand-navy">{p.title}</h2>
              {p.publishedAt && <p className="mt-1 text-xs text-gray-400">{formatDate(p.publishedAt)}</p>}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
