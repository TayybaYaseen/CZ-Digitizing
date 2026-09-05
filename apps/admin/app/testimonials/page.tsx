'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import type { ApiError, TestimonialDto } from '@czd/shared-types';
import { ApiClientError, apiFetch } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { ErrorBanner, SuccessBanner } from '@/components/ErrorBanner';
import { FormField, inputClass, submitButtonClass } from '@/components/FormField';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';

const schema = z.object({
  customerName: z.string().min(1, 'required').max(255),
  country: z.string().min(1, 'required'),
  business: z.string().optional(),
  photoUrl: z.string().url('must be a valid URL').optional().or(z.literal('')),
  rating: z.coerce.number().min(1).max(5),
  feedback: z.string().min(1, 'required'),
  serviceUsed: z.string().min(1, 'required'),
  isPublished: z.boolean().default(true),
});
type FormValues = z.infer<typeof schema>;

// docs/specs/2026-08-28-10-content-knowledge-base.md AC-4/AC-5/AC-6/AC-7 (aspect A-012c).
export default function TestimonialsAdminPage() {
  const router = useRouter();
  const { user, accessToken, isReady } = useAuth();
  const [testimonials, setTestimonials] = useState<TestimonialDto[] | null>(null);
  const [listError, setListError] = useState<ApiError | null>(null);
  const [apiError, setApiError] = useState<ApiError | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { rating: 5, isPublished: true } });

  const load = useCallback(async () => {
    if (!accessToken) return;
    setListError(null);
    try {
      setTestimonials(await apiFetch<TestimonialDto[]>('/api/testimonials/admin', { headers: { Authorization: `Bearer ${accessToken}` } }));
    } catch (err) {
      setListError(err instanceof ApiClientError ? err.error : { code: 'INTERNAL_ERROR', message: 'Failed to load testimonials.', traceId: '' });
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
      await apiFetch('/api/testimonials', {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ ...values, business: values.business || undefined, photoUrl: values.photoUrl || undefined }),
      });
      setSuccessMessage('Testimonial created.');
      reset({ customerName: '', country: '', business: '', photoUrl: '', rating: 5, feedback: '', serviceUsed: '', isPublished: true });
      load();
    } catch (err) {
      setApiError(err instanceof ApiClientError ? err.error : { code: 'INTERNAL_ERROR', message: 'Failed to save testimonial.', traceId: '' });
    }
  }

  async function onDelete(id: string) {
    try {
      await apiFetch(`/api/testimonials/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${accessToken}` } });
      load();
    } catch (err) {
      setListError(err instanceof ApiClientError ? err.error : { code: 'INTERNAL_ERROR', message: 'Failed to delete.', traceId: '' });
    }
  }

  async function moderate(id: string, decision: 'approved' | 'rejected') {
    try {
      await apiFetch(`/api/testimonials/${id}/moderate`, { method: 'PUT', headers: { Authorization: `Bearer ${accessToken}` }, body: JSON.stringify({ decision }) });
      load();
    } catch (err) {
      setListError(err instanceof ApiClientError ? err.error : { code: 'INTERNAL_ERROR', message: 'Failed to moderate.', traceId: '' });
    }
  }

  if (!isReady || !user) return null;

  const pending = (testimonials ?? []).filter((t) => t.moderationStatus === 'pending');
  const curated = (testimonials ?? []).filter((t) => t.source === 'admin_curated');

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold text-navy-800">Testimonials</h1>
        <p className="mt-1 text-sm text-gray-500">{testimonials?.length ?? 0} total</p>
      </div>

      <ErrorBanner error={listError} />
      {successMessage && <SuccessBanner message={successMessage} />}

      {pending.length > 0 && (
        <Card title={`Pending customer reviews (${pending.length})`} padding="p-0">
          <table className="w-full text-left text-sm">
            <tbody>
              {pending.map((t) => (
                <tr key={t.id} className="border-b border-gray-100 last:border-0">
                  <td className="px-4 py-3">
                    <p className="font-semibold text-navy-800">{t.customerName}</p>
                    <p className="text-xs text-gray-500">
                      {t.serviceUsed} · {'★'.repeat(t.rating)}
                    </p>
                    <p className="mt-1 text-sm text-gray-700">{t.feedback}</p>
                  </td>
                  <td className="px-4 py-3 text-right space-x-2">
                    <Button variant="outlineNavy" size="sm" onClick={() => moderate(t.id, 'approved')}>
                      Approve
                    </Button>
                    <Button variant="outlineNavy" size="sm" onClick={() => moderate(t.id, 'rejected')}>
                      Reject
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <Card title="Admin-curated testimonials" padding="p-0">
        {curated.length === 0 ? (
          <p className="p-4 text-sm text-gray-400">No curated testimonials yet.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-xs uppercase tracking-wide text-gray-400">
                <th className="px-4 py-3 font-medium">Customer</th>
                <th className="px-4 py-3 font-medium">Rating</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 text-right font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {curated.map((t) => (
                <tr key={t.id} className="border-b border-gray-100 last:border-0">
                  <td className="px-4 py-3 font-semibold text-navy-800">{t.customerName}</td>
                  <td className="px-4 py-3">{'★'.repeat(t.rating)}</td>
                  <td className="px-4 py-3">
                    <Badge tone={t.isPublished ? 'success' : 'warning'}>{t.isPublished ? 'Published' : 'Draft'}</Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button variant="outlineNavy" size="sm" onClick={() => onDelete(t.id)}>
                      Delete
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Card title="Create testimonial">
        {/* AC-5 — content-governance rule, process-enforced, must be visible here. */}
        <div className="mb-4 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
          ⚠ Only enter real customer testimonials. Never fabricate a customer name, country, or review — this is a
          content-governance rule, and every entry must reflect an actual customer.
        </div>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3" noValidate>
          <div className="grid grid-cols-2 gap-2">
            <FormField label="Customer name" htmlFor="customerName" error={errors.customerName}>
              <input id="customerName" className={inputClass} {...register('customerName')} />
            </FormField>
            <FormField label="Country" htmlFor="country" error={errors.country}>
              <input id="country" className={inputClass} {...register('country')} />
            </FormField>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <FormField label="Business (optional)" htmlFor="business" error={errors.business}>
              <input id="business" className={inputClass} {...register('business')} />
            </FormField>
            <FormField label="Photo URL (optional)" htmlFor="photoUrl" error={errors.photoUrl}>
              <input id="photoUrl" className={inputClass} {...register('photoUrl')} />
            </FormField>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <FormField label="Rating (1-5)" htmlFor="rating" error={errors.rating}>
              <input id="rating" type="number" min={1} max={5} className={inputClass} {...register('rating')} />
            </FormField>
            <FormField label="Service used" htmlFor="serviceUsed" error={errors.serviceUsed}>
              <input id="serviceUsed" className={inputClass} {...register('serviceUsed')} />
            </FormField>
          </div>
          <FormField label="Feedback" htmlFor="feedback" error={errors.feedback}>
            <textarea id="feedback" rows={3} className={inputClass} {...register('feedback')} />
          </FormField>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" {...register('isPublished')} />
            Published
          </label>
          <ErrorBanner error={apiError} />
          <button type="submit" disabled={isSubmitting} className={submitButtonClass}>
            Create testimonial
          </button>
        </form>
      </Card>
    </div>
  );
}
