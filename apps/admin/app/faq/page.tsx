'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import type { ApiError, FaqDto } from '@czd/shared-types';
import { ApiClientError, apiFetch } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { ErrorBanner, SuccessBanner } from '@/components/ErrorBanner';
import { FormField, inputClass, submitButtonClass } from '@/components/FormField';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';

const schema = z.object({
  question: z.string().min(1, 'required'),
  answer: z.string().min(1, 'required'),
  topic: z.string().min(1, 'required'),
  relatedPage: z.string().optional(),
  relatedService: z.string().optional(),
  relatedCategory: z.string().optional(),
  languageCode: z.string().min(2).default('en'),
  priority: z.coerce.number().min(0).default(0),
  taeboVisible: z.boolean().default(false),
  isPublished: z.boolean().default(true),
});
type FormValues = z.infer<typeof schema>;

// docs/specs/2026-08-28-10-content-knowledge-base.md AC-1/AC-2/AC-6/AC-8 (aspect A-012a).
export default function FaqAdminPage() {
  const router = useRouter();
  const { user, accessToken, isReady } = useAuth();
  const [faqs, setFaqs] = useState<FaqDto[] | null>(null);
  const [listError, setListError] = useState<ApiError | null>(null);
  const [apiError, setApiError] = useState<ApiError | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { languageCode: 'en', priority: 0, taeboVisible: false, isPublished: true } });

  const load = useCallback(async () => {
    if (!accessToken) return;
    setListError(null);
    try {
      setFaqs(await apiFetch<FaqDto[]>('/api/faqs', { headers: { Authorization: `Bearer ${accessToken}` } }));
    } catch (err) {
      setListError(err instanceof ApiClientError ? err.error : { code: 'INTERNAL_ERROR', message: 'Failed to load FAQs.', traceId: '' });
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

  function startEdit(faq: FaqDto) {
    setEditingId(faq.id);
    reset({
      question: faq.question,
      answer: faq.answer,
      topic: faq.topic,
      relatedPage: faq.relatedPage ?? '',
      relatedService: faq.relatedService ?? '',
      relatedCategory: faq.relatedCategory ?? '',
      languageCode: faq.languageCode,
      priority: faq.priority,
      taeboVisible: faq.taeboVisible,
      isPublished: faq.isPublished,
    });
  }

  async function onSubmit(values: FormValues) {
    setApiError(null);
    setSuccessMessage(null);
    const body = {
      question: values.question,
      answer: values.answer,
      topic: values.topic,
      relatedPage: values.relatedPage || undefined,
      relatedService: values.relatedService || undefined,
      relatedCategory: values.relatedCategory || undefined,
      languageCode: values.languageCode,
      priority: values.priority,
      taeboVisible: values.taeboVisible,
      isPublished: values.isPublished,
    };
    try {
      if (editingId) {
        await apiFetch(`/api/faqs/${editingId}`, { method: 'PUT', headers: { Authorization: `Bearer ${accessToken}` }, body: JSON.stringify(body) });
        setSuccessMessage('FAQ updated.');
      } else {
        await apiFetch('/api/faqs', { method: 'POST', headers: { Authorization: `Bearer ${accessToken}` }, body: JSON.stringify(body) });
        setSuccessMessage('FAQ created.');
      }
      setEditingId(null);
      reset({ question: '', answer: '', topic: '', relatedPage: '', relatedService: '', relatedCategory: '', languageCode: 'en', priority: 0, taeboVisible: false, isPublished: true });
      load();
    } catch (err) {
      setApiError(err instanceof ApiClientError ? err.error : { code: 'INTERNAL_ERROR', message: 'Failed to save FAQ.', traceId: '' });
    }
  }

  async function onDelete(id: string) {
    try {
      await apiFetch(`/api/faqs/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${accessToken}` } });
      load();
    } catch (err) {
      setListError(err instanceof ApiClientError ? err.error : { code: 'INTERNAL_ERROR', message: 'Failed to delete.', traceId: '' });
    }
  }

  async function togglePublish(faq: FaqDto) {
    try {
      await apiFetch(`/api/faqs/${faq.id}`, { method: 'PUT', headers: { Authorization: `Bearer ${accessToken}` }, body: JSON.stringify({ isPublished: !faq.isPublished }) });
      load();
    } catch (err) {
      setListError(err instanceof ApiClientError ? err.error : { code: 'INTERNAL_ERROR', message: 'Failed to update.', traceId: '' });
    }
  }

  if (!isReady || !user) return null;

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold text-navy-800">FAQ</h1>
        <p className="mt-1 text-sm text-gray-500">{faqs?.length ?? 0} entries</p>
      </div>

      <ErrorBanner error={listError} />
      {successMessage && <SuccessBanner message={successMessage} />}

      <Card padding="p-0">
        {faqs === null ? (
          <p className="p-4 text-sm text-gray-400">Loading…</p>
        ) : faqs.length === 0 ? (
          <p className="p-4 text-sm text-gray-400">No FAQs yet.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-xs uppercase tracking-wide text-gray-400">
                <th className="px-4 py-3 font-medium">Question</th>
                <th className="px-4 py-3 font-medium">Topic</th>
                <th className="px-4 py-3 font-medium">Helpful</th>
                <th className="px-4 py-3 font-medium">Taebo</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 text-right font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {faqs.map((faq) => (
                <tr key={faq.id} className="border-b border-gray-100 last:border-0">
                  <td className="px-4 py-3 font-semibold text-navy-800">{faq.question}</td>
                  <td className="px-4 py-3">{faq.topic}</td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {faq.helpfulYesCount} yes / {faq.helpfulNoCount} no
                  </td>
                  <td className="px-4 py-3">{faq.taeboVisible ? <Badge tone="success">Visible</Badge> : <Badge tone="warning">Hidden</Badge>}</td>
                  <td className="px-4 py-3">
                    <button onClick={() => togglePublish(faq)}>
                      <Badge tone={faq.isPublished ? 'success' : 'warning'}>{faq.isPublished ? 'Published' : 'Draft'}</Badge>
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right space-x-2">
                    <Button variant="outlineNavy" size="sm" onClick={() => startEdit(faq)}>
                      Edit
                    </Button>
                    <Button variant="outlineNavy" size="sm" onClick={() => onDelete(faq.id)}>
                      Delete
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Card title={editingId ? 'Edit FAQ' : 'Create FAQ'}>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3" noValidate>
          <FormField label="Question" htmlFor="question" error={errors.question}>
            <input id="question" className={inputClass} {...register('question')} />
          </FormField>
          <FormField label="Answer" htmlFor="answer" error={errors.answer}>
            <textarea id="answer" rows={3} className={inputClass} {...register('answer')} />
          </FormField>
          <div className="grid grid-cols-2 gap-2">
            <FormField label="Topic" htmlFor="topic" error={errors.topic}>
              <input id="topic" className={inputClass} {...register('topic')} />
            </FormField>
            <FormField label="Language code" htmlFor="languageCode" error={errors.languageCode}>
              <input id="languageCode" className={inputClass} {...register('languageCode')} />
            </FormField>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <FormField label="Related page" htmlFor="relatedPage" error={errors.relatedPage}>
              <input id="relatedPage" className={inputClass} {...register('relatedPage')} />
            </FormField>
            <FormField label="Related service" htmlFor="relatedService" error={errors.relatedService}>
              <input id="relatedService" className={inputClass} {...register('relatedService')} />
            </FormField>
            <FormField label="Related category" htmlFor="relatedCategory" error={errors.relatedCategory}>
              <input id="relatedCategory" className={inputClass} {...register('relatedCategory')} />
            </FormField>
          </div>
          <FormField label="Priority" htmlFor="priority" error={errors.priority}>
            <input id="priority" type="number" className={inputClass} {...register('priority')} />
          </FormField>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" {...register('taeboVisible')} />
            Visible to Taebo
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" {...register('isPublished')} />
            Published
          </label>
          <ErrorBanner error={apiError} />
          <div className="flex gap-2">
            <button type="submit" disabled={isSubmitting} className={submitButtonClass}>
              {editingId ? 'Save changes' : 'Create FAQ'}
            </button>
            {editingId && (
              <Button
                type="button"
                variant="outlineNavy"
                onClick={() => {
                  setEditingId(null);
                  reset({ question: '', answer: '', topic: '', relatedPage: '', relatedService: '', relatedCategory: '', languageCode: 'en', priority: 0, taeboVisible: false, isPublished: true });
                }}
              >
                Cancel
              </Button>
            )}
          </div>
        </form>
      </Card>
    </div>
  );
}
