'use client';

import { useEffect, useMemo, useState } from 'react';
import type { ApiError, FaqDto } from '@czd/shared-types';
import { ApiClientError, apiFetch } from '@/lib/api-client';
import { ErrorBanner } from '@/components/ErrorBanner';

// docs/specs/2026-08-28-10-content-knowledge-base.md AC-1/AC-2/AC-8.
export default function FaqPage() {
  const [faqs, setFaqs] = useState<FaqDto[] | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [q, setQ] = useState('');
  const [topic, setTopic] = useState<string | null>(null);
  const [voted, setVoted] = useState<Record<string, 'yes' | 'no'>>({});

  useEffect(() => {
    apiFetch<FaqDto[]>('/api/faqs')
      .then(setFaqs)
      .catch((err) => setError(err instanceof ApiClientError ? err.error : { code: 'INTERNAL_ERROR', message: 'Could not load FAQs.', traceId: '' }));
  }, []);

  const topics = useMemo(() => Array.from(new Set((faqs ?? []).map((f) => f.topic))), [faqs]);

  const [searchResults, setSearchResults] = useState<FaqDto[] | null>(null);
  useEffect(() => {
    if (!q.trim()) {
      setSearchResults(null);
      return;
    }
    const timer = setTimeout(() => {
      apiFetch<FaqDto[]>(`/api/faqs/search?q=${encodeURIComponent(q)}`).then(setSearchResults).catch(() => setSearchResults([]));
    }, 250);
    return () => clearTimeout(timer);
  }, [q]);

  const visible = (searchResults ?? faqs ?? []).filter((f) => !topic || f.topic === topic);
  const grouped = useMemo(() => {
    const byTopic = new Map<string, FaqDto[]>();
    for (const f of visible) {
      if (!byTopic.has(f.topic)) byTopic.set(f.topic, []);
      byTopic.get(f.topic)!.push(f);
    }
    return byTopic;
  }, [visible]);

  async function vote(id: string, vote: 'yes' | 'no') {
    if (voted[id]) return;
    setVoted((v) => ({ ...v, [id]: vote }));
    try {
      await apiFetch(`/api/faqs/${id}/feedback`, { method: 'POST', body: JSON.stringify({ vote }) });
    } catch {
      // best-effort — the vote optimistically stays recorded client-side either way
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Frequently Asked Questions</h1>
        <p className="mt-1 text-sm text-gray-600">Answers to common questions about pricing, formats, and downloads.</p>
      </div>

      <ErrorBanner error={error} />

      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search FAQs…"
          className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
        <select value={topic ?? ''} onChange={(e) => setTopic(e.target.value || null)} className="rounded-md border border-gray-300 px-3 py-2 text-sm">
          <option value="">All topics</option>
          {topics.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>

      {faqs === null ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-14 animate-pulse rounded-md bg-gray-100" />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <div className="rounded-md border border-gray-200 px-4 py-6 text-center text-sm text-gray-500">
          <p>No questions in this topic yet.</p>
          <a href="/contact" className="mt-2 inline-block text-brand-navy underline">
            Contact us
          </a>
        </div>
      ) : (
        Array.from(grouped.entries()).map(([t, items]) => (
          <div key={t} className="space-y-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">{t}</h2>
            <div className="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white">
              {items.map((f) => (
                <details key={f.id} className="group px-4 py-3">
                  <summary className="cursor-pointer list-none text-sm font-medium text-brand-navy">{f.question}</summary>
                  <p className="mt-2 text-sm text-gray-700">{f.answer}</p>
                  <div className="mt-3 flex items-center gap-2 text-xs text-gray-500">
                    <span>Was this helpful?</span>
                    <button
                      type="button"
                      disabled={!!voted[f.id]}
                      onClick={() => vote(f.id, 'yes')}
                      className={`rounded border px-2 py-0.5 ${voted[f.id] === 'yes' ? 'border-emerald-400 bg-emerald-50 text-emerald-700' : 'border-gray-300'}`}
                    >
                      Yes
                    </button>
                    <button
                      type="button"
                      disabled={!!voted[f.id]}
                      onClick={() => vote(f.id, 'no')}
                      className={`rounded border px-2 py-0.5 ${voted[f.id] === 'no' ? 'border-red-400 bg-red-50 text-red-700' : 'border-gray-300'}`}
                    >
                      No
                    </button>
                  </div>
                </details>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
