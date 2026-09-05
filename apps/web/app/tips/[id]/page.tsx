'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { ApiError, FaqDto, TipDto } from '@czd/shared-types';
import { ApiClientError, apiFetch } from '@/lib/api-client';
import { ErrorBanner } from '@/components/ErrorBanner';

// docs/specs/2026-08-28-10-content-knowledge-base.md AC-3 — "linked from relevant FAQ entries".
export default function TipDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [tip, setTip] = useState<TipDto | null>(null);
  const [linkedFaqs, setLinkedFaqs] = useState<FaqDto[]>([]);
  const [error, setError] = useState<ApiError | null>(null);

  useEffect(() => {
    apiFetch<TipDto>(`/api/tips/${id}`)
      .then(setTip)
      .catch((err) => setError(err instanceof ApiClientError ? err.error : { code: 'INTERNAL_ERROR', message: 'Could not load this tip.', traceId: '' }));
  }, [id]);

  useEffect(() => {
    if (!tip?.linkedFaqIds.length) return;
    Promise.all(tip.linkedFaqIds.map((faqId) => apiFetch<FaqDto>(`/api/faqs/${faqId}`).catch(() => null))).then((rows) =>
      setLinkedFaqs(rows.filter((r): r is FaqDto => !!r)),
    );
  }, [tip]);

  if (error) {
    return (
      <div className="mx-auto max-w-2xl">
        <ErrorBanner error={error} />
      </div>
    );
  }

  if (!tip) return <p className="text-center text-sm text-gray-500">Loading…</p>;

  return (
    <article className="mx-auto max-w-2xl space-y-6">
      <Link href="/tips" className="text-sm text-brand-navy underline">
        ← All tips
      </Link>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{tip.category}</p>
        <h1 className="mt-1 text-2xl font-bold">{tip.title}</h1>
      </div>
      <div className="prose prose-sm max-w-none whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: tip.content }} />

      {linkedFaqs.length > 0 && (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
          <h2 className="text-sm font-semibold text-gray-700">Related questions</h2>
          <ul className="mt-2 space-y-1">
            {linkedFaqs.map((f) => (
              <li key={f.id}>
                <Link href="/faq" className="text-sm text-brand-navy underline">
                  {f.question}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </article>
  );
}
