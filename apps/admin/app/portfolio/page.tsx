'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ApiError, PortfolioItemDto } from '@czd/shared-types';
import { PORTFOLIO_CATEGORIES } from '@czd/shared-types';
import { ApiClientError, apiFetch } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { ErrorBanner, SuccessBanner } from '@/components/ErrorBanner';
import { FormField, inputClass, submitButtonClass } from '@/components/FormField';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';

const EMPTY_FORM = {
  title: '',
  description: '',
  mediaUrls: [] as string[],
  category: '',
  isPublished: true,
  isFeatured: false,
  originalArtworkUrl: '',
  embroideryResultUrl: '',
  closeUpImageUrl: '',
  beforeImageUrl: '',
  afterImageUrl: '',
  softwareUsedInput: '',
  embroideryType: '',
  stitchCount: '',
  sizeLabel: '',
  machineFormat: '',
  projectNotes: '',
  mediaAltTexts: {} as Record<string, string>,
};

type FormState = typeof EMPTY_FORM;

const ROLE_IMAGE_FIELDS: { key: keyof Pick<FormState, 'originalArtworkUrl' | 'embroideryResultUrl' | 'closeUpImageUrl' | 'beforeImageUrl' | 'afterImageUrl'>; label: string }[] = [
  { key: 'originalArtworkUrl', label: 'Original artwork' },
  { key: 'embroideryResultUrl', label: 'Embroidery result' },
  { key: 'closeUpImageUrl', label: 'Close-up detail' },
  { key: 'beforeImageUrl', label: 'Before' },
  { key: 'afterImageUrl', label: 'After' },
];

// docs/specs/2026-08-28-10-content-knowledge-base.md AC-12/AC-13 (aspect A-012f), extended per
// docs/portfolio-spec.md §10.1/§11 (Professional Portfolio enhancement) — real work-sample
// metadata only. No field here accepts CV/biography/experience/education/skills/software-
// expertise or contact-info text; that content is pre-populated in
// apps/web/lib/portfolio-profile-content.ts and the WhatsApp/email settings this admin already
// manages at /admin/settings/platform (spec §10.4) — neither is duplicated here.
export default function PortfolioAdminPage() {
  const router = useRouter();
  const { user, accessToken, isReady } = useAuth();
  const [items, setItems] = useState<PortfolioItemDto[] | null>(null);
  const [listError, setListError] = useState<ApiError | null>(null);
  const [apiError, setApiError] = useState<ApiError | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [busy, setBusy] = useState(false);
  const [uploadingField, setUploadingField] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    if (!accessToken) return;
    setListError(null);
    try {
      setItems(await apiFetch<PortfolioItemDto[]>('/api/portfolio', { headers: { Authorization: `Bearer ${accessToken}` } }));
    } catch (err) {
      setListError(err instanceof ApiClientError ? err.error : { code: 'INTERNAL_ERROR', message: 'Failed to load portfolio.', traceId: '' });
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

  function startEdit(item: PortfolioItemDto) {
    setEditingId(item.id);
    setForm({
      title: item.title,
      description: item.description ?? '',
      mediaUrls: item.mediaUrls,
      category: item.category ?? '',
      isPublished: item.isPublished,
      isFeatured: item.isFeatured,
      originalArtworkUrl: item.originalArtworkUrl ?? '',
      embroideryResultUrl: item.embroideryResultUrl ?? '',
      closeUpImageUrl: item.closeUpImageUrl ?? '',
      beforeImageUrl: item.beforeImageUrl ?? '',
      afterImageUrl: item.afterImageUrl ?? '',
      softwareUsedInput: item.softwareUsed.join(', '),
      embroideryType: item.embroideryType ?? '',
      stitchCount: item.stitchCount != null ? String(item.stitchCount) : '',
      sizeLabel: item.sizeLabel ?? '',
      machineFormat: item.machineFormat ?? '',
      projectNotes: item.projectNotes ?? '',
      mediaAltTexts: item.mediaAltTexts ?? {},
    });
  }

  async function uploadOne(file: File): Promise<string> {
    const uploadForm = new FormData();
    uploadForm.append('file', file);
    const { url } = await apiFetch<{ url: string }>('/api/uploads/images', { method: 'POST', headers: { Authorization: `Bearer ${accessToken}` }, body: uploadForm });
    return url;
  }

  async function onMediaSelected(fileList: FileList | null) {
    const files = Array.from(fileList ?? []);
    if (!files.length) return;
    setUploadingField('media');
    try {
      const urls = await Promise.all(files.map(uploadOne));
      setForm((f) => ({ ...f, mediaUrls: [...f.mediaUrls, ...urls] }));
    } catch (err) {
      setApiError(err instanceof ApiClientError ? err.error : { code: 'INTERNAL_ERROR', message: 'Image upload failed.', traceId: '' });
    } finally {
      setUploadingField(null);
    }
  }

  function removeMedia(url: string) {
    setForm((f) => {
      const { [url]: _removed, ...restAlt } = f.mediaAltTexts;
      return { ...f, mediaUrls: f.mediaUrls.filter((u) => u !== url), mediaAltTexts: restAlt };
    });
  }

  function setMediaAlt(url: string, alt: string) {
    setForm((f) => ({ ...f, mediaAltTexts: { ...f.mediaAltTexts, [url]: alt } }));
  }

  async function onRoleImageSelected(field: (typeof ROLE_IMAGE_FIELDS)[number]['key'], fileList: FileList | null) {
    const file = fileList?.[0];
    if (!file) return;
    setUploadingField(field);
    try {
      const url = await uploadOne(file);
      setForm((f) => ({ ...f, [field]: url }));
    } catch (err) {
      setApiError(err instanceof ApiClientError ? err.error : { code: 'INTERNAL_ERROR', message: 'Image upload failed.', traceId: '' });
    } finally {
      setUploadingField(null);
    }
  }

  async function onSubmit() {
    setApiError(null);
    setSuccessMessage(null);
    if (!form.mediaUrls.length && !form.originalArtworkUrl && !form.embroideryResultUrl) {
      setApiError({ code: 'VALIDATION_ERROR', message: 'At least one image is required.', traceId: '' });
      return;
    }
    setBusy(true);
    try {
      const body = {
        title: form.title,
        description: form.description || undefined,
        category: form.category || undefined,
        mediaUrls: form.mediaUrls.length ? form.mediaUrls : [form.originalArtworkUrl || form.embroideryResultUrl].filter(Boolean),
        isPublished: form.isPublished,
        isFeatured: form.isFeatured,
        originalArtworkUrl: form.originalArtworkUrl || undefined,
        embroideryResultUrl: form.embroideryResultUrl || undefined,
        closeUpImageUrl: form.closeUpImageUrl || undefined,
        beforeImageUrl: form.beforeImageUrl || undefined,
        afterImageUrl: form.afterImageUrl || undefined,
        softwareUsed: form.softwareUsedInput
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        embroideryType: form.embroideryType || undefined,
        stitchCount: form.stitchCount ? Number(form.stitchCount) : undefined,
        sizeLabel: form.sizeLabel || undefined,
        machineFormat: form.machineFormat || undefined,
        projectNotes: form.projectNotes || undefined,
        mediaAltTexts: form.mediaAltTexts,
      };
      if (editingId) {
        await apiFetch(`/api/portfolio/${editingId}`, { method: 'PUT', headers: { Authorization: `Bearer ${accessToken}` }, body: JSON.stringify(body) });
        setSuccessMessage('Item updated.');
      } else {
        await apiFetch('/api/portfolio', { method: 'POST', headers: { Authorization: `Bearer ${accessToken}` }, body: JSON.stringify(body) });
        setSuccessMessage('Item created.');
      }
      setEditingId(null);
      setForm(EMPTY_FORM);
      if (fileInputRef.current) fileInputRef.current.value = '';
      load();
    } catch (err) {
      setApiError(err instanceof ApiClientError ? err.error : { code: 'INTERNAL_ERROR', message: 'Failed to save item.', traceId: '' });
    } finally {
      setBusy(false);
    }
  }

  async function onDelete(id: string) {
    try {
      await apiFetch(`/api/portfolio/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${accessToken}` } });
      load();
    } catch (err) {
      setListError(err instanceof ApiClientError ? err.error : { code: 'INTERNAL_ERROR', message: 'Failed to delete.', traceId: '' });
    }
  }

  // AC-13 — move up/down, writes sortOrder for all items so the change reflects immediately.
  async function move(index: number, direction: -1 | 1) {
    if (!items) return;
    const next = [...items];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target]!, next[index]!];
    setItems(next);
    try {
      await apiFetch('/api/portfolio/reorder', {
        method: 'PUT',
        headers: { Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ items: next.map((it, i) => ({ id: it.id, sortOrder: i })) }),
      });
    } catch (err) {
      setListError(err instanceof ApiClientError ? err.error : { code: 'INTERNAL_ERROR', message: 'Failed to reorder.', traceId: '' });
      load();
    }
  }

  if (!isReady || !user) return null;

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold text-navy-800">Portfolio</h1>
        <p className="mt-1 text-sm text-gray-500">{items?.length ?? 0} items</p>
      </div>

      <ErrorBanner error={listError} />
      {successMessage && <SuccessBanner message={successMessage} />}

      <Card padding="p-0">
        {items === null ? (
          <p className="p-4 text-sm text-gray-400">Loading…</p>
        ) : items.length === 0 ? (
          <p className="p-4 text-sm text-gray-400">No portfolio items yet.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-xs uppercase tracking-wide text-gray-400">
                <th className="px-4 py-3 font-medium">Image</th>
                <th className="px-4 py-3 font-medium">Title</th>
                <th className="px-4 py-3 font-medium">Featured</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 text-right font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, i) => (
                <tr key={item.id} className="border-b border-gray-100 last:border-0">
                  <td className="px-4 py-3">
                    {item.embroideryResultUrl || item.originalArtworkUrl || item.mediaUrls[0] ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.embroideryResultUrl || item.originalArtworkUrl || item.mediaUrls[0]} alt="" className="h-11 w-11 rounded-field object-cover" />
                    ) : (
                      <div className="h-11 w-11 rounded-field bg-gray-100" />
                    )}
                  </td>
                  <td className="px-4 py-3 font-semibold text-navy-800">{item.title}</td>
                  <td className="px-4 py-3">{item.isFeatured && <Badge tone="info">Featured</Badge>}</td>
                  <td className="px-4 py-3">
                    <Badge tone={item.isPublished ? 'success' : 'warning'}>{item.isPublished ? 'Published' : 'Draft'}</Badge>
                  </td>
                  <td className="px-4 py-3 text-right space-x-1">
                    <Button variant="outlineNavy" size="sm" onClick={() => move(i, -1)} disabled={i === 0}>
                      ↑
                    </Button>
                    <Button variant="outlineNavy" size="sm" onClick={() => move(i, 1)} disabled={i === items.length - 1}>
                      ↓
                    </Button>
                    <Button variant="outlineNavy" size="sm" onClick={() => startEdit(item)}>
                      Edit
                    </Button>
                    <Button variant="outlineNavy" size="sm" onClick={() => onDelete(item.id)}>
                      Delete
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Card title={editingId ? 'Edit item' : 'Create item'}>
        <div className="space-y-4">
          <FormField label="Title" htmlFor="title">
            <input id="title" className={inputClass} value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
          </FormField>
          <FormField label="Description" htmlFor="description">
            <textarea id="description" rows={2} className={inputClass} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
          </FormField>
          <FormField label="Category" htmlFor="category">
            <select id="category" className={inputClass} value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}>
              <option value="">— none —</option>
              {PORTFOLIO_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </FormField>

          <div className="grid gap-3 sm:grid-cols-2">
            {ROLE_IMAGE_FIELDS.map(({ key, label }) => (
              <FormField key={key} label={label} htmlFor={key}>
                <div className="space-y-2">
                  {form[key] && (
                    <div className="relative w-fit">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={form[key]} alt="" className="h-20 w-20 rounded-field border border-gray-200 object-cover" />
                      <button
                        type="button"
                        onClick={() => setForm((f) => ({ ...f, [key]: '' }))}
                        className="absolute -right-1 -top-1 h-5 w-5 rounded-full bg-navy-800 text-xs text-white"
                      >
                        ×
                      </button>
                      <input
                        type="text"
                        placeholder="Alt text"
                        className={`${inputClass} mt-1 w-20 text-xs`}
                        value={form.mediaAltTexts[form[key]] ?? ''}
                        onChange={(e) => setMediaAlt(form[key], e.target.value)}
                      />
                    </div>
                  )}
                  <input
                    id={key}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    disabled={uploadingField === key}
                    onChange={(e) => onRoleImageSelected(key, e.target.files)}
                    className="block w-full text-xs text-gray-600 file:mr-2 file:rounded-field file:border-0 file:bg-gold-500 file:px-2 file:py-1 file:text-xs file:font-semibold file:text-navy-800"
                  />
                </div>
              </FormField>
            ))}
          </div>

          <FormField label="Additional gallery images" htmlFor="media">
            <div className="space-y-2">
              {form.mediaUrls.length > 0 && (
                <div className="flex flex-wrap gap-3">
                  {form.mediaUrls.map((url) => (
                    <div key={url} className="relative w-fit">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={url} alt="" className="h-16 w-16 rounded-field border border-gray-200 object-cover" />
                      <button
                        type="button"
                        onClick={() => removeMedia(url)}
                        className="absolute -right-1 -top-1 h-5 w-5 rounded-full bg-navy-800 text-xs text-white"
                      >
                        ×
                      </button>
                      <input
                        type="text"
                        placeholder="Alt text"
                        className={`${inputClass} mt-1 w-16 text-[10px]`}
                        value={form.mediaAltTexts[url] ?? ''}
                        onChange={(e) => setMediaAlt(url, e.target.value)}
                      />
                    </div>
                  ))}
                </div>
              )}
              <input
                ref={fileInputRef}
                id="media"
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                multiple
                disabled={uploadingField === 'media'}
                onChange={(e) => onMediaSelected(e.target.files)}
                className="block w-full text-sm text-gray-600 file:mr-3 file:rounded-field file:border-0 file:bg-gold-500 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-navy-800"
              />
            </div>
          </FormField>

          <div className="grid gap-3 sm:grid-cols-2">
            <FormField label="Software used (comma-separated)" htmlFor="softwareUsed">
              <input
                id="softwareUsed"
                placeholder="Wilcom Embroidery Software, Pulse Tajima Embroidery Software"
                className={inputClass}
                value={form.softwareUsedInput}
                onChange={(e) => setForm((f) => ({ ...f, softwareUsedInput: e.target.value }))}
              />
            </FormField>
            <FormField label="Embroidery type" htmlFor="embroideryType">
              <input id="embroideryType" className={inputClass} value={form.embroideryType} onChange={(e) => setForm((f) => ({ ...f, embroideryType: e.target.value }))} />
            </FormField>
            <FormField label="Stitch count" htmlFor="stitchCount">
              <input
                id="stitchCount"
                type="number"
                min={0}
                className={inputClass}
                value={form.stitchCount}
                onChange={(e) => setForm((f) => ({ ...f, stitchCount: e.target.value }))}
              />
            </FormField>
            <FormField label="Size" htmlFor="sizeLabel">
              <input id="sizeLabel" placeholder='e.g. 4" x 4"' className={inputClass} value={form.sizeLabel} onChange={(e) => setForm((f) => ({ ...f, sizeLabel: e.target.value }))} />
            </FormField>
            <FormField label="Machine format" htmlFor="machineFormat">
              <input id="machineFormat" placeholder="e.g. DST" className={inputClass} value={form.machineFormat} onChange={(e) => setForm((f) => ({ ...f, machineFormat: e.target.value }))} />
            </FormField>
          </div>

          <FormField label="Project notes (internal only, never shown to customers)" htmlFor="projectNotes">
            <textarea id="projectNotes" rows={2} className={inputClass} value={form.projectNotes} onChange={(e) => setForm((f) => ({ ...f, projectNotes: e.target.value }))} />
          </FormField>

          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={form.isPublished} onChange={(e) => setForm((f) => ({ ...f, isPublished: e.target.checked }))} />
              Published
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={form.isFeatured} onChange={(e) => setForm((f) => ({ ...f, isFeatured: e.target.checked }))} />
              Featured
            </label>
          </div>

          <ErrorBanner error={apiError} />
          <div className="flex gap-2">
            <button type="button" disabled={busy} onClick={onSubmit} className={submitButtonClass}>
              {editingId ? 'Save changes' : 'Create item'}
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
