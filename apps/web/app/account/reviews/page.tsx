'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import type { ApiError, MyTestimonialDto, TestimonialStatus } from '@czd/shared-types';
import { ApiClientError, apiFetch } from '@/lib/api-client';
import { API_URL } from '@/lib/api-url';
import { useAuth } from '@/lib/auth-context';
import { useLocale, type TranslationKey } from '@/lib/locale-context';
import { ErrorBanner } from '@/components/ErrorBanner';
import { clientError } from '@/i18n/api-errors';

const STATUS_LABEL: Record<TestimonialStatus, TranslationKey> = {
  pending: 'reviews.statusPending',
  published: 'reviews.statusPublished',
  hidden: 'reviews.statusHidden',
  rejected: 'reviews.statusRejected',
};

const STATUS_TONE: Record<TestimonialStatus, string> = {
  pending: 'bg-amber-50 text-amber-800 border-amber-200',
  published: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  hidden: 'bg-gray-100 text-gray-700 border-gray-200',
  rejected: 'bg-red-50 text-red-700 border-red-200',
};

// docs/specs/2026-10-06-22-customer-review-submission.md §21 (aspect A-026) — My Reviews: the
// customer's own reviews with their current status; withdraw permanently deletes one (D4).
export default function MyReviewsPage() {
  const router = useRouter();
  const { user, accessToken, isReady } = useAuth();
  const { t, formatDate } = useLocale();
  const [items, setItems] = useState<MyTestimonialDto[] | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (isReady && !user) router.replace(`/login?next=${encodeURIComponent('/account/reviews')}`);
  }, [isReady, user, router]);

  const load = useCallback(async () => {
    if (!accessToken) return;
    try {
      setItems(await apiFetch<MyTestimonialDto[]>('/api/testimonials/mine', { headers: { Authorization: `Bearer ${accessToken}` } }));
    } catch (err) {
      setError(err instanceof ApiClientError ? err.error : clientError('reviews.loadFailed'));
    }
  }, [accessToken]);

  useEffect(() => {
    if (user?.role === 'customer') load();
  }, [user, load]);

  async function withdraw(id: string) {
    if (!accessToken || !window.confirm(t('reviews.withdrawConfirm'))) return;
    setError(null);
    try {
      await apiFetch(`/api/testimonials/mine/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${accessToken}` } });
      setNotice(t('reviews.withdrawn'));
      setItems((list) => list?.filter((r) => r.id !== id) ?? null);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.error : clientError('reviews.withdrawFailed'));
    }
  }

  if (!isReady || !user) return null;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{t('reviews.myReviews')}</h1>
          <p className="mt-1 text-sm text-gray-600">{t('reviews.myReviewsSubtitle')}</p>
        </div>
        <Link href="/testimonials/write" className="rounded-md bg-brand-gold px-4 py-2 text-sm font-semibold text-brand-navy">
          {t('reviews.writeReview')}
        </Link>
      </div>

      <ErrorBanner error={error} />
      {notice && (
        <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800" role="status">
          {notice}
        </p>
      )}

      {items === null ? (
        error ? null : <div className="h-32 animate-pulse rounded-lg bg-gray-100" />
      ) : items.length === 0 ? (
        <p className="rounded-lg border border-dashed border-gray-300 px-4 py-8 text-center text-sm text-gray-600" data-testid="my-reviews-empty">
          {t('reviews.noMyReviews')}
        </p>
      ) : (
        <ul className="space-y-4" data-testid="my-reviews">
          {items.map((review) => (
            <li key={review.id} className="rounded-lg border border-gray-200 bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm text-gold-600" role="img" aria-label={t('reviews.starsLabel', { count: review.rating })}>
                    {'★'.repeat(review.rating)}
                    {'☆'.repeat(5 - review.rating)}
                  </p>
                  <p dir="auto" className="break-words text-sm font-semibold text-brand-navy">
                    {review.serviceUsed}
                    {review.linkedItemLabel ? <span className="font-normal text-gray-500"> · {t('reviews.linkedTo', { reference: review.linkedItemLabel })}</span> : null}
                  </p>
                </div>
                <span className={`shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${STATUS_TONE[review.status]}`} data-testid="my-review-status">
                  {t(STATUS_LABEL[review.status])}
                </span>
              </div>
              <p dir="auto" className="mt-2 whitespace-pre-line break-words text-sm text-gray-700">{review.feedback}</p>
              {review.originalFeedback && review.originalFeedback !== review.feedback && (
                <details className="mt-2 text-xs text-gray-500">
                  <summary className="cursor-pointer">{t('reviews.editedByAdmin')}</summary>
                  <p className="mt-1 font-medium">{t('reviews.yourOriginal')}</p>
                  <p dir="auto" className="whitespace-pre-line break-words">{review.originalFeedback}</p>
                </details>
              )}
              {review.hasImage && accessToken && <OwnImage id={review.id} accessToken={accessToken} alt={t('reviews.photoBy', { name: review.customerName })} />}
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500">
                <span>{t('reviews.submittedOn', { date: formatDate(review.createdAt, { dateStyle: 'medium' }) })}</span>
                <button type="button" onClick={() => withdraw(review.id)} className="rounded-md border border-red-200 px-3 py-1.5 font-medium text-red-700 hover:bg-red-50">
                  {t('reviews.withdraw')}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// A non-published review's photo is not publicly served, so it is fetched with the bearer token
// from the owner-only route and shown from an in-memory object URL (same pattern as the admin receipt preview).
function OwnImage({ id, accessToken, alt }: { id: string; accessToken: string; alt: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let objectUrl: string | null = null;
    let cancelled = false;
    fetch(`${API_URL}/api/testimonials/mine/${id}/image`, { headers: { Authorization: `Bearer ${accessToken}` }, credentials: 'include' })
      .then(async (res) => {
        if (!res.ok) return;
        const blob = await res.blob();
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [id, accessToken]);

  if (!url) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt={alt} className="mt-3 aspect-[4/3] w-full max-w-xs rounded-md border border-gray-100 object-cover" />
  );
}
