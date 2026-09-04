'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import type { ApiError, FaqDto, TipDto } from '@czd/shared-types';
import { ApiClientError, apiFetch, apiFetchWithMeta } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { ErrorBanner, SuccessBanner } from '@/components/ErrorBanner';
import { FormField, inputClass, submitButtonClass } from '@/components/FormField';
import { RichTextEditor } from '@/components/RichTextEditor';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';

const EMPTY_FORM = { title: '', content: '', category: '', languageCode: 'en', isPublished: true, faqIds: [] as string[] };

// docs/specs/2026-08-28-10-content-knowledge-base.md AC-3/AC-6 (aspect A-012b).
export default function TipsAdminPage() {
  const router = useRouter();
  const { user, accessToken, isReady } = useAuth();
  const [tips, setTips] = useState<TipDto[] | null>(null);
  const [faqs, setFaqs] = useState<FaqDto[]>([]);
  const [listError, setListError] = useState<ApiError | null>(null);
  const [apiError, setApiError] = useState<ApiError | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!accessToken) return;
    setListError(null);
    try {
      const [tipsRes, faqsRes] = await Promise.all([
        apiFetchWithMeta<TipDto[]>('/api/tips', { headers: { Authorization: `Bearer ${accessToken}` } }),
        apiFetch<FaqDto[]>('/api/faqs', { headers: { Authorization: `Bearer ${accessToken}` } }),
      ]);
      setTips(tipsRes.data);
      setFaqs(faqsRes);
    } catch (err) {
      setListError(err instanceof ApiClientError ? err.error : { code: 'INTERNAL_ERROR', message: 'Failed to load tips.', traceId: '' });
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

  function startEdit(tip: TipDto) {
    setEditingId(tip.id);
    setForm({ title: tip.title, content: tip.content, category: tip.category, languageCode: tip.languageCode, isPublished: tip.isPublished, faqIds: tip.linkedFaqIds });
  }

  function toggleFaqLink(faqId: string) {
    setForm((f) => ({ ...f, faqIds: f.faqIds.includes(faqId) ? f.faqIds.filter((id) => id !== faqId) : [...f.faqIds, faqId] }));
  }

  async function onSubmit() {
    setApiError(null);
    setSuccessMessage(null);
    setBusy(true);
    try {
      if (editingId) {
        await apiFetch(`/api/tips/${editingId}`, { method: 'PUT', headers: { Authorization: `Bearer ${accessToken}` }, body: JSON.stringify(form) });
        setSuccessMessage('Tip updated.');
      } else {
        await apiFetch('/api/tips', { method: 'POST', headers: { Authorization: `Bearer ${accessToken}` }, body: JSON.stringify(form) });
        setSuccessMessage('Tip created.');
      }
      setEditingId(null);
      setForm(EMPTY_FORM);
      load();
    } catch (err) {
      setApiError(err instanceof ApiClientError ? err.error : { code: 'INTERNAL_ERROR', message: 'Failed to save tip.', traceId: '' });
    } finally {
      setBusy(false);
    }
  }

  async function onDelete(id: string) {
    try {
      await apiFetch(`/api/tips/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${accessToken}` } });
      load();
    } catch (err) {
      setListError(err instanceof ApiClientError ? err.error : { code: 'INTERNAL_ERROR', message: 'Failed to delete.', traceId: '' });
    }
  }

  if (!isReady || !user) return null;

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold text-navy-800">Tips for Embroiderers</h1>
        <p className="mt-1 text-sm text-gray-500">{tips?.length ?? 0} tips</p>
      </div>

      <ErrorBanner error={listError} />
      {successMessage && <SuccessBanner message={successMessage} />}

      <Card padding="p-0">
        {tips === null ? (
          <p className="p-4 text-sm text-gray-400">Loading…</p>
        ) : tips.length === 0 ? (
          <p className="p-4 text-sm text-gray-400">No tips yet.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-xs uppercase tracking-wide text-gray-400">
                <th className="px-4 py-3 font-medium">Title</th>
                <th className="px-4 py-3 font-medium">Category</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 text-right font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {tips.map((tip) => (
                <tr key={tip.id} className="border-b border-gray-100 last:border-0">
                  <td className="px-4 py-3 font-semibold text-navy-800">{tip.title}</td>
                  <td className="px-4 py-3">{tip.category}</td>
                  <td className="px-4 py-3">
                    <Badge tone={tip.isPublished ? 'success' : 'warning'}>{tip.isPublished ? 'Published' : 'Draft'}</Badge>
                  </td>
                  <td className="px-4 py-3 text-right space-x-2">
                    <Button variant="outlineNavy" size="sm" onClick={() => startEdit(tip)}>
                      Edit
                    </Button>
                    <Button variant="outlineNavy" size="sm" onClick={() => onDelete(tip.id)}>
                      Delete
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Card title={editingId ? 'Edit Tip' : 'Create Tip'}>
        <div className="space-y-3">
          <FormField label="Title" htmlFor="title">
            <input id="title" className={inputClass} value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
          </FormField>
          <div className="grid grid-cols-2 gap-2">
            <FormField label="Category" htmlFor="category">
              <input id="category" className={inputClass} value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} />
            </FormField>
            <FormField label="Language code" htmlFor="languageCode">
              <input id="languageCode" className={inputClass} value={form.languageCode} onChange={(e) => setForm((f) => ({ ...f, languageCode: e.target.value }))} />
            </FormField>
          </div>
          <FormField label="Content" htmlFor="content">
            <RichTextEditor value={form.content} onChange={(html) => setForm((f) => ({ ...f, content: html }))} accessToken={accessToken} />
          </FormField>
          {faqs.length > 0 && (
            <div>
              <p className="text-sm font-medium text-gray-600">Linked FAQ entries</p>
              <div className="mt-1 flex flex-wrap gap-2">
                {faqs.map((faq) => (
                  <button
                    key={faq.id}
                    type="button"
                    onClick={() => toggleFaqLink(faq.id)}
                    className={`rounded-full border px-2.5 py-1 text-xs ${form.faqIds.includes(faq.id) ? 'border-gold-500 bg-gold-50 text-gold-700' : 'border-gray-300 text-gray-600'}`}
                  >
                    {faq.question}
                  </button>
                ))}
              </div>
            </div>
          )}
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={form.isPublished} onChange={(e) => setForm((f) => ({ ...f, isPublished: e.target.checked }))} />
            Published
          </label>
          <ErrorBanner error={apiError} />
          <div className="flex gap-2">
            <button type="button" disabled={busy} onClick={onSubmit} className={submitButtonClass}>
              {editingId ? 'Save changes' : 'Create tip'}
            </button>
            {editingId && (
              <Button
                type="button"
                variant="outlineNavy"
                onClick={() => {
                  setEditingId(null);
                  setForm(EMPTY_FORM);
                }}
              >
                Cancel
              </Button>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
