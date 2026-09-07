'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import type { ApiError, TaeboWaitingQuestionDto } from '@czd/shared-types';
import { ApiClientError, apiFetch } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { ErrorBanner, SuccessBanner } from '@/components/ErrorBanner';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';

// docs/specs/2026-08-28-15-taebo-chatbot.md AC-3/AC-5 (aspect A-020).
export default function TaeboUnansweredPage() {
  const router = useRouter();
  const { user, accessToken, isReady } = useAuth();

  const [questions, setQuestions] = useState<TaeboWaitingQuestionDto[] | null>(null);
  const [listError, setListError] = useState<ApiError | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!accessToken) return;
    setListError(null);
    try {
      const rows = await apiFetch<TaeboWaitingQuestionDto[]>('/api/taebo/unanswered', { headers: { Authorization: `Bearer ${accessToken}` } });
      setQuestions(rows);
    } catch (err) {
      setListError(err instanceof ApiClientError ? err.error : { code: 'INTERNAL_ERROR', message: 'Failed to load waiting questions.', traceId: '' });
    }
  }, [accessToken]);

  useEffect(() => {
    if (!isReady) return;
    if (!user) {
      router.replace('/login');
      return;
    }
    load();
  }, [isReady, user, load, router]);

  async function answer(id: string) {
    const answerText = drafts[id]?.trim();
    if (!answerText) return;
    setBusyId(id);
    setListError(null);
    try {
      await apiFetch(`/api/taebo/unanswered/${id}/answer`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ answer: answerText }),
      });
      setSuccessMessage('Answer sent to the customer.');
      await load();
    } catch (err) {
      setListError(err instanceof ApiClientError ? err.error : { code: 'INTERNAL_ERROR', message: 'Failed to send answer.', traceId: '' });
    } finally {
      setBusyId(null);
    }
  }

  async function saveAsFaq(id: string) {
    setBusyId(id);
    setListError(null);
    try {
      await apiFetch(`/api/taebo/unanswered/${id}/save-as-faq`, { method: 'POST', headers: { Authorization: `Bearer ${accessToken}` } });
      setSuccessMessage('Saved as a reusable FAQ entry.');
      await load();
    } catch (err) {
      setListError(err instanceof ApiClientError ? err.error : { code: 'INTERNAL_ERROR', message: 'Failed to save as FAQ.', traceId: '' });
    } finally {
      setBusyId(null);
    }
  }

  if (!isReady || !user) return null;

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold text-navy-800">Taebo — Waiting for Admin</h1>
        <p className="mt-1 text-sm text-gray-500">Questions Taebo could not answer from approved content.</p>
      </div>

      <ErrorBanner error={listError} />
      {successMessage && <SuccessBanner message={successMessage} />}

      {questions === null ? (
        <p className="text-sm text-gray-400">Loading…</p>
      ) : questions.length === 0 ? (
        <Card>
          <p className="text-sm text-gray-400">No questions waiting — Taebo has answered everything it can.</p>
        </Card>
      ) : (
        <div className="space-y-4">
          {questions.map((q) => (
            <Card key={q.id} className="space-y-3">
              <div className="flex items-start justify-between gap-4">
                <p className="font-medium text-navy-800">{q.questionText}</p>
                <Badge tone={q.status === 'waiting' ? 'warning' : 'success'}>{q.status}</Badge>
              </div>

              {q.status === 'answered' ? (
                <div className="space-y-2">
                  <p className="text-sm text-gray-600">{q.adminAnswer}</p>
                  {q.savedAsFaqId ? (
                    <Badge tone="success">Saved as FAQ</Badge>
                  ) : (
                    <Button variant="outlineNavy" size="sm" disabled={busyId === q.id} onClick={() => saveAsFaq(q.id)}>
                      Save as FAQ
                    </Button>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  <textarea
                    className="w-full rounded border border-gray-200 p-2 text-sm"
                    rows={3}
                    placeholder="Write the answer for this customer…"
                    value={drafts[q.id] ?? ''}
                    onChange={(e) => setDrafts((prev) => ({ ...prev, [q.id]: e.target.value }))}
                  />
                  <Button size="sm" disabled={busyId === q.id || !drafts[q.id]?.trim()} onClick={() => answer(q.id)}>
                    Send answer
                  </Button>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
