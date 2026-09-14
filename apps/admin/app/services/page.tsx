'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import type { ApiError, ServiceDetailDto, ServiceSummaryDto } from '@czd/shared-types';
import { ApiClientError, apiFetch } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { ErrorBanner, SuccessBanner } from '@/components/ErrorBanner';
import { FormField, inputClass, submitButtonClass } from '@/components/FormField';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';

interface MainServiceDto extends ServiceSummaryDto {
  subServices: ServiceSummaryDto[];
}

// Mirrors apps/api/src/designs/dto/category.dto.ts's CategoryDto — not shared via @czd/shared-types
// since only this one admin picker needs it.
interface CategoryOption {
  id: string;
  name: string;
}

// AC-10 — an edit's worth of fields, shared by the main-service edit panel and the sub-service edit
// panel (they're the same shape; only which endpoint/list they update differs).
interface EditForm {
  name: string;
  slug: string;
  description: string;
  visualImageUrl: string;
  applications: string;
  process: string;
  relatedDesignCategoryId: string;
}

const EMPTY_EDIT: EditForm = { name: '', slug: '', description: '', visualImageUrl: '', applications: '', process: '', relatedDesignCategoryId: '' };

function toEditForm(service: ServiceDetailDto): EditForm {
  return {
    name: service.name,
    slug: service.slug,
    description: service.description,
    visualImageUrl: service.visualImageUrl,
    applications: service.applications,
    process: service.process,
    relatedDesignCategoryId: service.relatedDesignCategoryId ?? '',
  };
}

const schema = z.object({
  name: z.string().min(1, 'required').max(255),
  slug: z.string().min(1, 'required').max(255),
  type: z.enum(['embroidery_digitizing', 'vector_art']),
  description: z.string().min(1, 'required'),
  visualImageUrl: z.string().min(1, 'required'),
  applications: z.string().min(1, 'required'),
  process: z.string().min(1, 'required'),
  relatedDesignCategoryId: z.string().optional(),
  isPublished: z.boolean().default(true),
});
type FormValues = z.infer<typeof schema>;

// docs/specs/2026-08-29-17-services-module.md AC-1/AC-2/AC-3/AC-8/AC-10 — admin creates, edits,
// reorders, publishes, and links (to a Design Catalog category) the two main services and their
// sub-categories, with no code deploy.
export default function ServicesAdminPage() {
  const router = useRouter();
  const { user, accessToken, isReady } = useAuth();
  const [services, setServices] = useState<MainServiceDto[] | null>(null);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [listError, setListError] = useState<ApiError | null>(null);
  const [apiError, setApiError] = useState<ApiError | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [subName, setSubName] = useState('');
  const [subSlug, setSubSlug] = useState('');
  const [subDescription, setSubDescription] = useState('');
  const [subApplications, setSubApplications] = useState('');
  const [subProcess, setSubProcess] = useState('');
  const [subCategoryId, setSubCategoryId] = useState('');

  // AC-8/AC-10 — which service (main or sub) is being edited, and its in-progress field values.
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EditForm>(EMPTY_EDIT);
  const [editLoading, setEditLoading] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { isPublished: true, type: 'embroidery_digitizing', relatedDesignCategoryId: '' } });

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

  const loadCategories = useCallback(async () => {
    if (!accessToken) return;
    try {
      const list = await apiFetch<CategoryOption[]>('/api/categories', { headers: { Authorization: `Bearer ${accessToken}` } });
      setCategories(list);
    } catch {
      // Non-critical — the relatedDesignCategoryId picker just renders empty (AC-10 link stays optional).
      setCategories([]);
    }
  }, [accessToken]);

  useEffect(() => {
    if (!isReady) return;
    if (!user) {
      router.replace('/login');
      return;
    }
    load();
    loadCategories();
  }, [isReady, user, load, loadCategories, router]);

  async function onSubmit(values: FormValues) {
    setApiError(null);
    setSuccessMessage(null);
    try {
      await apiFetch('/api/services', {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ ...values, relatedDesignCategoryId: values.relatedDesignCategoryId || undefined }),
      });
      setSuccessMessage(`Service "${values.name}" created.`);
      reset({ name: '', slug: '', type: 'embroidery_digitizing', description: '', visualImageUrl: '', applications: '', process: '', relatedDesignCategoryId: '', isPublished: true });
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

  // AC-8 — swaps this service's sortOrder with the sibling immediately before/after it in the same
  // list (main services, or one main service's own sub-services) via two sequential reorder calls.
  async function onMove(siblings: ServiceSummaryDto[], service: ServiceSummaryDto, direction: 'up' | 'down') {
    const index = siblings.findIndex((s) => s.id === service.id);
    const neighborIndex = direction === 'up' ? index - 1 : index + 1;
    if (index === -1 || neighborIndex < 0 || neighborIndex >= siblings.length) return;
    const neighbor = siblings[neighborIndex];
    if (!neighbor) return;
    setApiError(null);
    try {
      await apiFetch(`/api/services/${service.id}/reorder`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ sortOrder: neighbor.sortOrder }),
      });
      await apiFetch(`/api/services/${neighbor.id}/reorder`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ sortOrder: service.sortOrder }),
      });
      load();
    } catch (err) {
      setApiError(err instanceof ApiClientError ? err.error : { code: 'INTERNAL_ERROR', message: 'Failed to reorder.', traceId: '' });
    }
  }

  // AC-8/AC-10 — opens the edit panel pre-filled with this service's full detail (the list endpoint
  // only returns summary fields — no applications/process/relatedDesignCategoryId — so this fetches
  // the same public detail route the customer-facing page itself uses).
  async function startEdit(service: ServiceSummaryDto) {
    setApiError(null);
    setEditingId(service.id);
    setEditLoading(true);
    try {
      const detail = await apiFetch<ServiceDetailDto>(`/api/services/${service.slug}`, { headers: { Authorization: `Bearer ${accessToken}` } });
      setEditForm(toEditForm(detail));
    } catch (err) {
      setApiError(err instanceof ApiClientError ? err.error : { code: 'INTERNAL_ERROR', message: 'Failed to load service detail.', traceId: '' });
      setEditingId(null);
    } finally {
      setEditLoading(false);
    }
  }

  function cancelEdit() {
    setEditingId(null);
    setEditForm(EMPTY_EDIT);
  }

  async function onSaveEdit() {
    if (!editingId) return;
    setApiError(null);
    try {
      await apiFetch(`/api/services/${editingId}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ ...editForm, relatedDesignCategoryId: editForm.relatedDesignCategoryId || null }),
      });
      setSuccessMessage(`Service "${editForm.name}" updated.`);
      cancelEdit();
      load();
    } catch (err) {
      setApiError(err instanceof ApiClientError ? err.error : { code: 'INTERNAL_ERROR', message: 'Failed to save changes.', traceId: '' });
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
          relatedDesignCategoryId: subCategoryId || undefined,
          isPublished: true,
        }),
      });
      setSubName('');
      setSubSlug('');
      setSubDescription('');
      setSubApplications('');
      setSubProcess('');
      setSubCategoryId('');
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

  function renderEditPanel() {
    if (editLoading) return <p className="mt-3 text-xs text-gray-400">Loading…</p>;
    return (
      <div className="mt-3 space-y-2 rounded-md bg-gold-100/40 p-3">
        <input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} placeholder="Name" className={`${inputClass} text-xs`} />
        <input value={editForm.slug} onChange={(e) => setEditForm({ ...editForm, slug: e.target.value })} placeholder="Slug" className={`${inputClass} text-xs`} />
        <textarea
          value={editForm.description}
          onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
          placeholder="Description"
          rows={2}
          className={`${inputClass} text-xs`}
        />
        <input
          value={editForm.visualImageUrl}
          onChange={(e) => setEditForm({ ...editForm, visualImageUrl: e.target.value })}
          placeholder="Visual image URL"
          className={`${inputClass} text-xs`}
        />
        <textarea
          value={editForm.applications}
          onChange={(e) => setEditForm({ ...editForm, applications: e.target.value })}
          placeholder="Applications"
          rows={2}
          className={`${inputClass} text-xs`}
        />
        <textarea value={editForm.process} onChange={(e) => setEditForm({ ...editForm, process: e.target.value })} placeholder="Process" rows={2} className={`${inputClass} text-xs`} />
        <select value={editForm.relatedDesignCategoryId} onChange={(e) => setEditForm({ ...editForm, relatedDesignCategoryId: e.target.value })} className={`${inputClass} text-xs`}>
          <option value="">No linked Design Catalog category</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <div className="flex gap-2">
          <Button size="sm" onClick={onSaveEdit}>
            Save
          </Button>
          <Button size="sm" variant="outlineNavy" onClick={cancelEdit}>
            Cancel
          </Button>
        </div>
      </div>
    );
  }

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
            {services.map((service, mainIndex) => (
              <li key={service.id} className="p-3">
                <div className="flex items-center justify-between">
                  <button onClick={() => setExpanded(expanded === service.id ? null : service.id)} className="text-left text-sm font-medium text-navy-800 hover:text-gold-600">
                    {service.name} <span className="text-gray-400">/{service.slug}</span>
                    {!service.isPublished && <span className="ml-2 text-xs text-status-redFg">(unpublished)</span>}
                  </button>
                  <div className="flex gap-2">
                    <button onClick={() => onMove(services, service, 'up')} disabled={mainIndex === 0} className="text-gray-400 hover:text-navy-800 disabled:opacity-30" aria-label="Move up">
                      ↑
                    </button>
                    <button
                      onClick={() => onMove(services, service, 'down')}
                      disabled={mainIndex === services.length - 1}
                      className="text-gray-400 hover:text-navy-800 disabled:opacity-30"
                      aria-label="Move down"
                    >
                      ↓
                    </button>
                    <Button variant="outlineNavy" size="sm" onClick={() => startEdit(service)}>
                      Edit
                    </Button>
                    <Button variant="outlineNavy" size="sm" onClick={() => onTogglePublish(service)}>
                      {service.isPublished ? 'Unpublish' : 'Publish'}
                    </Button>
                    <Button variant="outlineNavy" size="sm" onClick={() => onDelete(service.id)}>
                      Delete
                    </Button>
                  </div>
                </div>

                {editingId === service.id && renderEditPanel()}

                {expanded === service.id && (
                  <div className="mt-3 space-y-2 border-t border-gray-100 pt-3">
                    {service.subServices.map((sub, subIndex) => (
                      <div key={sub.id}>
                        <div className="flex items-center justify-between text-xs text-gray-600">
                          <span>
                            {sub.name} <span className="text-gray-400">/{sub.slug}</span>
                            {!sub.isPublished && <span className="ml-2 text-status-redFg">(unpublished)</span>}
                          </span>
                          <div className="flex items-center gap-3">
                            <button onClick={() => onMove(service.subServices, sub, 'up')} disabled={subIndex === 0} className="text-gray-400 hover:text-navy-800 disabled:opacity-30" aria-label="Move up">
                              ↑
                            </button>
                            <button
                              onClick={() => onMove(service.subServices, sub, 'down')}
                              disabled={subIndex === service.subServices.length - 1}
                              className="text-gray-400 hover:text-navy-800 disabled:opacity-30"
                              aria-label="Move down"
                            >
                              ↓
                            </button>
                            <button onClick={() => startEdit(sub)} className="hover:underline">
                              Edit
                            </button>
                            <button onClick={() => onTogglePublish(sub)} className="hover:underline">
                              {sub.isPublished ? 'Unpublish' : 'Publish'}
                            </button>
                            <button onClick={() => onDeleteSubService(sub.id)} className="text-status-redFg hover:underline">
                              Remove
                            </button>
                          </div>
                        </div>
                        {editingId === sub.id && renderEditPanel()}
                      </div>
                    ))}
                    <div className="grid grid-cols-2 gap-2">
                      <input value={subName} onChange={(e) => setSubName(e.target.value)} placeholder="Sub-service name" className={`${inputClass} text-xs`} />
                      <input value={subSlug} onChange={(e) => setSubSlug(e.target.value)} placeholder="slug" className={`${inputClass} text-xs`} />
                      <input value={subDescription} onChange={(e) => setSubDescription(e.target.value)} placeholder="Description" className={`${inputClass} col-span-2 text-xs`} />
                      <input value={subApplications} onChange={(e) => setSubApplications(e.target.value)} placeholder="Applications" className={`${inputClass} text-xs`} />
                      <input value={subProcess} onChange={(e) => setSubProcess(e.target.value)} placeholder="Process" className={`${inputClass} text-xs`} />
                      <select value={subCategoryId} onChange={(e) => setSubCategoryId(e.target.value)} className={`${inputClass} col-span-2 text-xs`}>
                        <option value="">No linked Design Catalog category</option>
                        {categories.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
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
          <FormField label="Linked Design Catalog category (optional, AC-10)" htmlFor="relatedDesignCategoryId" error={errors.relatedDesignCategoryId}>
            <select id="relatedDesignCategoryId" className={inputClass} {...register('relatedDesignCategoryId')}>
              <option value="">No linked category</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
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
