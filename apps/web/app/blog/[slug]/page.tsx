'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { ApiError, BlogPostDto } from '@czd/shared-types';
import { ApiClientError, apiFetch } from '@/lib/api-client';
import { ErrorBanner } from '@/components/ErrorBanner';

export default function BlogPostPage() {
  const { slug } = useParams<{ slug: string }>();
  const [post, setPost] = useState<BlogPostDto | null>(null);
  const [error, setError] = useState<ApiError | null>(null);

  useEffect(() => {
    apiFetch<BlogPostDto>(`/api/blog/${slug}`)
      .then(setPost)
      .catch((err) => setError(err instanceof ApiClientError ? err.error : { code: 'INTERNAL_ERROR', message: 'Could not load this post.', traceId: '' }));
  }, [slug]);

  if (error) {
    return (
      <div className="mx-auto max-w-2xl">
        <ErrorBanner error={error} />
      </div>
    );
  }

  if (!post) return <p className="text-center text-sm text-gray-500">Loading…</p>;

  return (
    <article className="mx-auto max-w-2xl space-y-6">
      <Link href="/blog" className="text-sm text-brand-navy underline">
        ← All posts
      </Link>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{post.category}</p>
        <h1 className="mt-1 text-2xl font-bold">{post.title}</h1>
        {post.publishedAt && <p className="mt-1 text-xs text-gray-400">{new Date(post.publishedAt).toLocaleDateString()}</p>}
      </div>
      {post.coverImageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={post.coverImageUrl} alt={post.title} className="w-full rounded-lg object-cover" />
      )}
      <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: post.body }} />
    </article>
  );
}
