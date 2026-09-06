'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ApiError, HeaderMediaDto } from '@czd/shared-types';
import { ApiClientError, apiFetch } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { ErrorBanner, SuccessBanner } from '@/components/ErrorBanner';
import { FormField, inputClass, submitButtonClass } from '@/components/FormField';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';

const EMPTY_FORM = {
  imageUrl: '',
  videoUrl: '',
  heading: '',
  subheading: '',
  ctaLink: '',
  priority: 0,
  isActive: true,
  visibleDesktop: true,
  visibleMobileWeb: true,
  visibleMobileApp: true,
  autoSlideDurationSeconds: 5,
};

// docs/specs/2026-08-28-13-home-promotions-cms.md AC-6/AC-10/AC-11 (aspect A-018c).
export default function HeaderMediaAdminPage() {
  const router = useRouter();
  const { user, accessToken, isReady } = useAuth();
  const [items, setItems] = useState<HeaderMediaDto[] | null>(null);
  const [listError, setListError] = useState<ApiError | null>(null);
  const [apiError, setApiError] = useState<ApiError | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [busy, setBusy] = useState(false);
  const [imageUploading, setImageUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    if (!accessToken) return;
    setListError(null);
    try {
      setItems(await apiFetch<HeaderMediaDto[]>('/api/admin/header-media', { headers: { Authorization: `Bearer ${accessToken}` } }));
    } catch (err) {
      setListError(err instanceof ApiClientError ? err.error : { code: 'INTERNAL_ERROR', message: 'Failed to load header media.', traceId: '' });
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

  function startEdit(item: HeaderMediaDto) {
    setEditingId(item.id);
    setForm({
      imageUrl: item.imageUrl ?? '',
      videoUrl: item.videoUrl ?? '',
      heading: item.heading ?? '',
      subheading: item.subheading ?? '',
      ctaLink: item.ctaLink ?? '',
      priority: item.priority,
      isActive: true,
      visibleDesktop: true,
      visibleMobileWeb: true,
      visibleMobileApp: true,
      autoSlideDurationSeconds: item.autoSlideDurationSeconds,
    });
  }

  async function onImageSelected(fileList: FileList | null) {
    const file = fileList?.item(0);
    if (!file) return;
    setImageUploading(true);
    try {
      const uploadForm = new FormData();
      uploadForm.append('file', file);
      const { url } = await apiFetch<{ url: string }>('/api/uploads/images', { method: 'POST', headers: { Authorization: `Bearer ${accessToken}` }, body: uploadForm });
      setForm((f) => ({ ...f, imageUrl: url }));
    } catch (err) {
      setApiError(err instanceof ApiClientError ? err.error : { code: 'INTERNAL_ERROR', message: 'Image upload failed.', traceId: '' });
    } finally {
      setImageUploading(false);
    }
  }

  async function onSubmit() {
    setApiError(null);
    setSuccessMessage(null);
    setBusy(true);
    try {
      const body = { ...form, imageUrl: form.imageUrl || undefined, videoUrl: form.videoUrl || undefined };
      if (editingId) {
        await apiFetch(`/api/admin/header-media/${editingId}`, { method: 'PUT', headers: { Authorization: `Bearer ${accessToken}` }, body: JSON.stringify(body) });
        setSuccessMessage('Header media updated.');
      } else {
        await apiFetch('/api/admin/header-media', { method: 'POST', headers: { Authorization: `Bearer ${accessToken}` }, body: JSON.stringify(body) });
        setSuccessMessage('Header media created.');
      }
      setEditingId(null);
      setForm(EMPTY_FORM);
      if (fileInputRef.current) fileInputRef.current.value = '';
      load();
    } catch (err) {
      setApiError(err instanceof ApiClientError ? err.error : { code: 'INTERNAL_ERROR', message: 'Failed to save header media.', traceId: '' });
    } finally {
      setBusy(false);
    }
  }

  async function onDelete(id: string) {
    try {
      await apiFetch(`/api/admin/header-media/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${accessToken}` } });
      load();
    } catch (err) {
      setListError(err instanceof ApiClientError ? err.error : { code: 'INTERNAL_ERROR', message: 'Failed to delete.', traceId: '' });
    }
  }

  if (!isReady || !user) return null;

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold text-navy-800">Header Media</h1>
        <p className="mt-1 text-sm text-gray-500">{items?.length ?? 0} items — highest priority shows first, carousel if more than one is active</p>
      </div>

      <ErrorBanner error={listError} />
      {successMessage && <SuccessBanner message={successMessage} />}

      <Card padding="p-0">
        {items === null ? (
          <p className="p-4 text-sm text-gray-400">Loading…</p>
        ) : items.length === 0 ? (
          <p className="p-4 text-sm text-gray-400">No header media yet.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-xs uppercase tracking-wide text-gray-400">
                <th className="px-4 py-3 font-medium">Image</th>
                <th className="px-4 py-3 font-medium">Heading</th>
                <th className="px-4 py-3 font-medium">Priority</th>
                <th className="px-4 py-3 text-right font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-b border-gray-100 last:border-0">
                  <td className="px-4 py-3">
                    {item.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.imageUrl} alt="" className="h-11 w-16 rounded-field object-cover" />
                    ) : (
                      <div className="h-11 w-16 rounded-field bg-gray-100" />
                    )}
                  </td>
                  <td className="px-4 py-3 font-semibold text-navy-800">{item.heading ?? '—'}</td>
                  <td className="px-4 py-3">
                    <Badge tone="info">{item.priority}</Badge>
                  </td>
                  <td className="px-4 py-3 text-right space-x-2">
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

      <Card title={editingId ? 'Edit header media' : 'Create header media'}>
        <div className="space-y-3">
          <FormField label="Image" htmlFor="image">
            <div className="flex items-center gap-3">
              {form.imageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={form.imageUrl} alt="" className="h-14 w-24 rounded-field border border-gray-200 object-cover" />
              )}
              <input
                ref={fileInputRef}
                id="image"
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                disabled={imageUploading}
                onChange={(e) => onImageSelected(e.target.files)}
                className="block flex-1 text-sm text-gray-600 file:mr-3 file:rounded-field file:border-0 file:bg-gold-500 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-navy-800"
              />
            </div>
          </FormField>
          <FormField label="Video URL (optional)" htmlFor="videoUrl">
            <input id="videoUrl" className={inputClass} value={form.videoUrl} onChange={(e) => setForm((f) => ({ ...f, videoUrl: e.target.value }))} />
          </FormField>
          <div className="grid grid-cols-2 gap-2">
            <FormField label="Heading (optional)" htmlFor="heading">
              <input id="heading" className={inputClass} value={form.heading} onChange={(e) => setForm((f) => ({ ...f, heading: e.target.value }))} />
            </FormField>
            <FormField label="Subheading (optional)" htmlFor="subheading">
              <input id="subheading" className={inputClass} value={form.subheading} onChange={(e) => setForm((f) => ({ ...f, subheading: e.target.value }))} />
            </FormField>
          </div>
          <FormField label="CTA link (optional)" htmlFor="ctaLink">
            <input id="ctaLink" className={inputClass} value={form.ctaLink} onChange={(e) => setForm((f) => ({ ...f, ctaLink: e.target.value }))} />
          </FormField>
          <div className="grid grid-cols-2 gap-2">
            <FormField label="Priority" htmlFor="priority">
              <input id="priority" type="number" className={inputClass} value={form.priority} onChange={(e) => setForm((f) => ({ ...f, priority: Number(e.target.value) }))} />
            </FormField>
            <FormField label="Auto-slide duration (seconds)" htmlFor="autoSlideDurationSeconds">
              <input
                id="autoSlideDurationSeconds"
                type="number"
                min={1}
                max={60}
                className={inputClass}
                value={form.autoSlideDurationSeconds}
                onChange={(e) => setForm((f) => ({ ...f, autoSlideDurationSeconds: Number(e.target.value) }))}
              />
            </FormField>
          </div>
          <div className="grid grid-cols-3 gap-2 text-sm text-gray-700">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={form.visibleDesktop} onChange={(e) => setForm((f) => ({ ...f, visibleDesktop: e.target.checked }))} />
              Desktop
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={form.visibleMobileWeb} onChange={(e) => setForm((f) => ({ ...f, visibleMobileWeb: e.target.checked }))} />
              Mobile web
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={form.visibleMobileApp} onChange={(e) => setForm((f) => ({ ...f, visibleMobileApp: e.target.checked }))} />
              Mobile app
            </label>
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={form.isActive} onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))} />
            Active
          </label>
          <ErrorBanner error={apiError} />
          <div className="flex gap-2">
            <button type="button" disabled={busy} onClick={onSubmit} className={submitButtonClass}>
              {editingId ? 'Save changes' : 'Create header media'}
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
