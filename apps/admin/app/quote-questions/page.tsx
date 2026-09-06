'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import type { ApiError, QuoteQuestionDto } from '@czd/shared-types';
import { ApiClientError, apiFetch } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { ErrorBanner, SuccessBanner } from '@/components/ErrorBanner';
import { FormField, inputClass, submitButtonClass } from '@/components/FormField';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';

interface ServiceOption {
  id: string;
  name: string;
  subServices: { id: string; name: string }[];
}

const schema = z.object({
  question: z.string().min(1, 'required'),
  answer: z.string().min(1, 'required'),
  serviceId: z.string().min(1, 'required'),
  isPublished: z.boolean().default(true),
});
type FormValues = z.infer<typeof schema>;

// docs/specs/2026-08-28-11-smart-get-a-quote.md AC-1/AC-5 (aspect A-016a).
export default function QuoteQuestionsAdminPage() {
  const router = useRouter();
  const { user, accessToken, isReady } = useAuth();
  const [questions, setQuestions] = useState<QuoteQuestionDto[] | null>(null);
  const [services, setServices] = useState<ServiceOption[]>([]);
  const [listError, setListError] = useState<ApiError | null>(null);
  const [apiError, setApiError] = useState<ApiError | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { isPublished: true } });

  const load = useCallback(async () => {
    if (!accessToken) return;
    setListError(null);
    try {
      const [questionList, serviceList] = await Promise.all([
        apiFetch<QuoteQuestionDto[]>('/api/quote-questions', { headers: { Authorization: `Bearer ${accessToken}` } }),
        apiFetch<ServiceOption[]>('/api/services', { headers: { Authorization: `Bearer ${accessToken}` } }),
      ]);
      setQuestions(questionList);
      setServices(serviceList);
    } catch (err) {
      setListError(err instanceof ApiClientError ? err.error : { code: 'INTERNAL_ERROR', message: 'Failed to load quote questions.', traceId: '' });
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

  async function onSubmit(values: FormValues) {
    setApiError(null);
    setSuccessMessage(null);
    try {
      await apiFetch('/api/quote-questions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify(values),
      });
      setSuccessMessage('Question created.');
      reset({ question: '', answer: '', serviceId: '', isPublished: true });
      load();
    } catch (err) {
      setApiError(err instanceof ApiClientError ? err.error : { code: 'INTERNAL_ERROR', message: 'Failed to create question.', traceId: '' });
    }
  }

  async function onDelete(id: string) {
    try {
      await apiFetch(`/api/quote-questions/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${accessToken}` } });
      load();
    } catch (err) {
      setListError(err instanceof ApiClientError ? err.error : { code: 'INTERNAL_ERROR', message: 'Failed to delete.', traceId: '' });
    }
  }

  const serviceName = (id: string) => {
    for (const s of services) {
      if (s.id === id) return s.name;
      const sub = s.subServices.find((x) => x.id === id);
      if (sub) return `${s.name} — ${sub.name}`;
    }
    return id;
  };

  if (!isReady || !user) return null;

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold text-navy-800">Quote Questions</h1>
        <p className="mt-1 text-sm text-gray-500">Step 2&apos;s Admin-curated Q&amp;A, scoped per service (AC-1/AC-5).</p>
      </div>

      <ErrorBanner error={listError} />
      {successMessage && <SuccessBanner message={successMessage} />}
      <ErrorBanner error={apiError} />

      <Card padding="p-0">
        {questions === null ? (
          <p className="p-4 text-sm text-gray-400">Loading…</p>
        ) : questions.length === 0 ? (
          <p className="p-4 text-sm text-gray-400">No questions yet.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {questions.map((q) => (
              <li key={q.id} className="flex items-center justify-between p-3 text-sm">
                <div>
                  <p className="font-medium text-navy-800">{q.question}</p>
                  <p className="text-xs text-gray-500">{serviceName(q.serviceId)}</p>
                </div>
                <Button variant="outlineNavy" size="sm" onClick={() => onDelete(q.id)}>
                  Delete
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="Add question">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3" noValidate>
          <FormField label="Service" htmlFor="serviceId" error={errors.serviceId}>
            <select id="serviceId" className={inputClass} {...register('serviceId')}>
              <option value="">Select a service…</option>
              {services.map((s) => (
                <optgroup key={s.id} label={s.name}>
                  <option value={s.id}>{s.name} (main)</option>
                  {s.subServices.map((sub) => (
                    <option key={sub.id} value={sub.id}>
                      {sub.name}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </FormField>
          <FormField label="Question" htmlFor="question" error={errors.question}>
            <input id="question" className={inputClass} {...register('question')} />
          </FormField>
          <FormField label="Answer" htmlFor="answer" error={errors.answer}>
            <textarea id="answer" className={inputClass} rows={3} {...register('answer')} />
          </FormField>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" {...register('isPublished')} />
            Published
          </label>
          <button type="submit" disabled={isSubmitting} className={submitButtonClass}>
            Create question
          </button>
        </form>
      </Card>
    </div>
  );
}
