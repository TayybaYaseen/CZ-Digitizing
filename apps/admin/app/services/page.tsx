'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import type { ApiError } from '@czd/shared-types';
import { ApiClientError, apiFetch } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { ErrorBanner, SuccessBanner } from '@/components/ErrorBanner';
import { FormField, inputClass, submitButtonClass } from '@/components/FormField';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';

// Mirrors apps/api/src/services/dto/service.dto.ts / packages/shared-types/src/services.ts.
interface ServiceSummaryDto {
  id: string;
  name: string;
  slug: string;
  type: 'embroidery_digitizing' | 'vector_art';
  parentServiceId: string | null;
  description: string;
  visualImageUrl: string;
  sortOrder: number;
  isPublished: boolean;
}
interface MainServiceDto extends ServiceSummaryDto {
  subServices: ServiceSummaryDto[];
}

const schema = z.object({
  name: z.string().min(1, 'required').max(255),
  slug: z.string().min(1, 'required').max(255),
  type: z.enum(['embroidery_digitizing', 'vector_art']),
  description: z.string().min(1, 'required'),
  visualImageUrl: z.string().min(1, 'required'),
  applications: z.string().min(1, 'required'),
  process: z.string().min(1, 'required'),
  isPublished: z.boolean().default(true),
});
type FormValues = z.infer<typeof schema>;

// docs/specs/2026-08-29-17-services-module.md AC-1/AC-2/AC-3/AC-8 — admin creates/edits the two
// main services and their sub-categories with no code deploy.
export default function ServicesAdminPage() {
  const router = useRouter();
  const { user, accessToken, isReady } = useAuth();
  const [services, setServices] = useState<MainServiceDto[] | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [listError, setListError] = useState<ApiError | null>(null);
  const [apiError, setApiError] = useState<ApiError | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [subName, setSubName] = useState('');
  const [subSlug, setSubSlug] = useState('');
  const [subDescription, setSubDescription] = useState('');
  const [subApplications, setSubApplications] = useState('');
  const [subProcess, setSubProcess] = useState('');

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { isPublished: true, type: 'embroidery_digitizing' } });

  const load = useCallback(async () => {
    if (!accessToken) return;
    setListError(null);
    try {
      const list = await apiFetch<MainServiceDto[]>('/api/services', { headers: { Authorization: `Bearer ${accessToken}` } });
      setServices(list);
    } catch (err) {
      setListError(err instanceof ApiClientError ? err.error : { code: 'INTERNAL_ERROR', message: 'Failed to load services.', traceId: '' });
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
      await apiFetch('/api/services', {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify(values),
      });
      setSuccessMessage(`Service "${values.name}" created.`);
      reset({ name: '', slug: '', type: 'embroidery_digitizing', description: '', visualImageUrl: '', applications: '', process: '', isPublished: true });
      load();
    } catch (err) {
      setApiError(err instanceof ApiClientError ? err.error : { code: 'INTERNAL_ERROR', message: 'Failed to create service.', traceId: '' });
    }
  }

  async function onDelete(id: string) {
    try {
      await apiFetch(`/api/services/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${accessToken}` } });
      load();
    } catch (err) {
      setListError(err instanceof ApiClientError ? err.error : { code: 'INTERNAL_ERROR', message: 'Failed to delete.', traceId: '' });
    }
  }

  async function onTogglePublish(service: ServiceSummaryDto) {
    try {
      await apiFetch(`/api/services/${service.id}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ isPublished: !service.isPublished }),
      });
      load();
    } catch (err) {
      setApiError(err instanceof ApiClientError ? err.error : { code: 'INTERNAL_ERROR', message: 'Failed to update.', traceId: '' });
    }
  }

  async function onCreateSubService(main: MainServiceDto) {
    if (!subName.trim() || !subSlug.trim() || !subDescription.trim() || !subApplications.trim() || !subProcess.trim()) return;
    try {
      await apiFetch('/api/services', {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({
          name: subName,
          slug: subSlug,
          type: main.type,
          parentServiceId: main.id,
          description: subDescription,
          visualImageUrl: main.visualImageUrl,
          applications: subApplications,
          process: subProcess,
          isPublished: true,
        }),
      });
      setSubName('');
      setSubSlug('');
      setSubDescription('');
      setSubApplications('');
      setSubProcess('');
      load();
    } catch (err) {
      setApiError(err instanceof ApiClientError ? err.error : { code: 'INTERNAL_ERROR', message: 'Failed to create sub-service.', traceId: '' });
    }
  }

  async function onDeleteSubService(id: string) {
    try {
      await apiFetch(`/api/services/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${accessToken}` } });
      load();
    } catch (err) {
      setApiError(err instanceof ApiClientError ? err.error : { code: 'INTERNAL_ERROR', message: 'Failed to delete sub-service.', traceId: '' });
    }
  }

  if (!isReady || !user) return null;

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold text-navy-800">Services</h1>
        <p className="mt-1 text-sm text-gray-500">
          Embroidery Digitizing and Vector Art, plus their sub-categories (AC-1/AC-2/AC-3). Changes go live immediately, no code deploy (AC-8).
        </p>
      </div>

      <ErrorBanner error={listError} />
      {successMessage && <SuccessBanner message={successMessage} />}
      <ErrorBanner error={apiError} />

      <Card padding="p-0">
        {services === null ? (
          <p className="p-4 text-sm text-gray-400">Loading…</p>
        ) : services.length === 0 ? (
          <p className="p-4 text-sm text-gray-400">No services yet.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {services.map((service) => (
              <li key={service.id} className="p-3">
                <div className="flex items-center justify-between">
                  <button onClick={() => setExpanded(expanded === service.id ? null : service.id)} className="text-left text-sm font-medium text-navy-800 hover:text-gold-600">
                    {service.name} <span className="text-gray-400">/{service.slug}</span>
                    {!service.isPublished && <span className="ml-2 text-xs text-status-redFg">(unpublished)</span>}
                  </button>
                  <div className="flex gap-2">
                    <Button variant="outlineNavy" size="sm" onClick={() => onTogglePublish(service)}>
                      {service.isPublished ? 'Unpublish' : 'Publish'}
                    </Button>
                    <Button variant="outlineNavy" size="sm" onClick={() => onDelete(service.id)}>
                      Delete
                    </Button>
                  </div>
                </div>

                {expanded === service.id && (
                  <div className="mt-3 space-y-2 border-t border-gray-100 pt-3">
                    {service.subServices.map((sub) => (
                      <div key={sub.id} className="flex items-center justify-between text-xs text-gray-600">
                        <span>
                          {sub.name} <span className="text-gray-400">/{sub.slug}</span>
                          {!sub.isPublished && <span className="ml-2 text-status-redFg">(unpublished)</span>}
                        </span>
                        <div className="flex gap-3">
                          <button onClick={() => onTogglePublish(sub)} className="hover:underline">
                            {sub.isPublished ? 'Unpublish' : 'Publish'}
                          </button>
                          <button onClick={() => onDeleteSubService(sub.id)} className="text-status-redFg hover:underline">
                            Remove
                          </button>
                        </div>
                      </div>
                    ))}
                    <div className="grid grid-cols-2 gap-2">
                      <input value={subName} onChange={(e) => setSubName(e.target.value)} placeholder="Sub-service name" className={`${inputClass} text-xs`} />
                      <input value={subSlug} onChange={(e) => setSubSlug(e.target.value)} placeholder="slug" className={`${inputClass} text-xs`} />
                      <input value={subDescription} onChange={(e) => setSubDescription(e.target.value)} placeholder="Description" className={`${inputClass} col-span-2 text-xs`} />
                      <input value={subApplications} onChange={(e) => setSubApplications(e.target.value)} placeholder="Applications" className={`${inputClass} text-xs`} />
                      <input value={subProcess} onChange={(e) => setSubProcess(e.target.value)} placeholder="Process" className={`${inputClass} text-xs`} />
                      <Button size="sm" onClick={() => onCreateSubService(service)} className="col-span-2 whitespace-nowrap">
                        Add sub-service
                      </Button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="Create main service">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3" noValidate>
          <FormField label="Name" htmlFor="name" error={errors.name}>
            <input id="name" className={inputClass} {...register('name')} />
          </FormField>
          <FormField label="Slug" htmlFor="slug" error={errors.slug}>
            <input id="slug" className={inputClass} {...register('slug')} />
          </FormField>
          <FormField label="Type" htmlFor="type" error={errors.type}>
            <select id="type" className={inputClass} {...register('type')}>
              <option value="embroidery_digitizing">Embroidery Digitizing</option>
              <option value="vector_art">Vector Art</option>
            </select>
          </FormField>
          <FormField label="Description" htmlFor="description" error={errors.description}>
            <textarea id="description" className={inputClass} rows={3} {...register('description')} />
          </FormField>
          <FormField label="Visual image URL" htmlFor="visualImageUrl" error={errors.visualImageUrl}>
            <input id="visualImageUrl" className={inputClass} {...register('visualImageUrl')} />
          </FormField>
          <FormField label="Applications" htmlFor="applications" error={errors.applications}>
            <textarea id="applications" className={inputClass} rows={2} {...register('applications')} />
          </FormField>
          <FormField label="Process" htmlFor="process" error={errors.process}>
            <textarea id="process" className={inputClass} rows={2} {...register('process')} />
          </FormField>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" {...register('isPublished')} />
            Published
          </label>
          <button type="submit" disabled={isSubmitting} className={submitButtonClass}>
            Create service
          </button>
        </form>
      </Card>
    </div>
  );
}
