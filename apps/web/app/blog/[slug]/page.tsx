'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { ApiError, BlogPostDto } from '@czd/shared-types';
import { ApiClientError, apiFetch } from '@/lib/api-client';
import { BackArrow } from '@/components/DirectionalArrow';
import { ErrorBanner } from '@/components/ErrorBanner';
import { useLocale } from '@/lib/locale-context';
import { clientError } from '@/i18n/api-errors';

export default function BlogPostPage() {
  const { slug } = useParams<{ slug: string }>();
  const { t, formatDate } = useLocale();
  const [post, setPost] = useState<BlogPostDto | null>(null);
  const [error, setError] = useState<ApiError | null>(null);

  useEffect(() => {
    apiFetch<BlogPostDto>(`/api/blog/${slug}`)
      .then(setPost)
      .catch((err) => setError(err instanceof ApiClientError ? err.error : clientError('errors.loadPostFailed')));
  }, [slug]);

  if (error) {
    return (
      <div className="mx-auto max-w-2xl">
        <ErrorBanner error={error} />
      </div>
    );
  }

  if (!post) return <p className="text-center text-sm text-gray-500">{t('common.loading')}</p>;

  return (
    <article className="mx-auto max-w-2xl space-y-6">
      <Link href="/blog" className="text-sm text-brand-navy underline">
        <BackArrow /> {t('blog.allPosts')}
      </Link>
      <div>
        <p dir="auto" className="text-xs font-semibold uppercase tracking-wide text-gray-500">{post.category}</p>
        <h1 dir="auto" className="mt-1 text-2xl font-bold">{post.title}</h1>
        {post.publishedAt && <p className="mt-1 text-xs text-gray-400">{formatDate(post.publishedAt)}</p>}
      </div>
      {post.coverImageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={post.coverImageUrl} alt={post.title} className="w-full rounded-lg object-cover" />
      )}
      <div dir="auto" className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: post.body }} />
    </article>
  );
}
