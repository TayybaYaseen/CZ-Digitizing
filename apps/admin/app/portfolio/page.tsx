'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ApiError, PortfolioItemDto } from '@czd/shared-types';
import { ApiClientError, apiFetch } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { ErrorBanner, SuccessBanner } from '@/components/ErrorBanner';
import { FormField, inputClass, submitButtonClass } from '@/components/FormField';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';

const EMPTY_FORM = { title: '', description: '', mediaUrls: [] as string[], category: '', isPublished: true };

// docs/specs/2026-08-28-10-content-knowledge-base.md AC-12/AC-13 (aspect A-012f). No languageCode
// field by design (AC-17) — title/description are language-neutral.
export default function PortfolioAdminPage() {
  const router = useRouter();
  const { user, accessToken, isReady } = useAuth();
  const [items, setItems] = useState<PortfolioItemDto[] | null>(null);
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
    setForm({ title: item.title, description: item.description ?? '', mediaUrls: item.mediaUrls, category: item.category ?? '', isPublished: item.isPublished });
  }

  async function onMediaSelected(fileList: FileList | null) {
    const files = Array.from(fileList ?? []);
    if (!files.length) return;
    setImageUploading(true);
    try {
      const urls = await Promise.all(
        files.map(async (file) => {
          const uploadForm = new FormData();
          uploadForm.append('file', file);
          const { url } = await apiFetch<{ url: string }>('/api/uploads/images', { method: 'POST', headers: { Authorization: `Bearer ${accessToken}` }, body: uploadForm });
          return url;
        }),
      );
      setForm((f) => ({ ...f, mediaUrls: [...f.mediaUrls, ...urls] }));
    } catch (err) {
      setApiError(err instanceof ApiClientError ? err.error : { code: 'INTERNAL_ERROR', message: 'Image upload failed.', traceId: '' });
    } finally {
      setImageUploading(false);
    }
  }

  function removeMedia(url: string) {
    setForm((f) => ({ ...f, mediaUrls: f.mediaUrls.filter((u) => u !== url) }));
  }

  async function onSubmit() {
    setApiError(null);
    setSuccessMessage(null);
    if (!form.mediaUrls.length) {
      setApiError({ code: 'VALIDATION_ERROR', message: 'At least one image is required.', traceId: '' });
      return;
    }
    setBusy(true);
    try {
      const body = { ...form, description: form.description || undefined, category: form.category || undefined };
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
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 text-right font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, i) => (
                <tr key={item.id} className="border-b border-gray-100 last:border-0">
                  <td className="px-4 py-3">
                    {item.mediaUrls[0] ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.mediaUrls[0]} alt="" className="h-11 w-11 rounded-field object-cover" />
                    ) : (
                      <div className="h-11 w-11 rounded-field bg-gray-100" />
                    )}
                  </td>
                  <td className="px-4 py-3 font-semibold text-navy-800">{item.title}</td>
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
        <div className="space-y-3">
          <FormField label="Title" htmlFor="title">
            <input id="title" className={inputClass} value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
          </FormField>
          <FormField label="Description" htmlFor="description">
            <textarea id="description" rows={2} className={inputClass} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
          </FormField>
          <FormField label="Category" htmlFor="category">
            <input id="category" className={inputClass} value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} />
          </FormField>
          <FormField label="Media" htmlFor="media">
            <div className="space-y-2">
              {form.mediaUrls.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {form.mediaUrls.map((url) => (
                    <div key={url} className="relative">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={url} alt="" className="h-16 w-16 rounded-field border border-gray-200 object-cover" />
                      <button
                        type="button"
                        onClick={() => removeMedia(url)}
                        className="absolute -right-1 -top-1 h-5 w-5 rounded-full bg-navy-800 text-xs text-white"
                      >
                        ×
                      </button>
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
                disabled={imageUploading}
                onChange={(e) => onMediaSelected(e.target.files)}
                className="block w-full text-sm text-gray-600 file:mr-3 file:rounded-field file:border-0 file:bg-gold-500 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-navy-800"
              />
            </div>
          </FormField>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={form.isPublished} onChange={(e) => setForm((f) => ({ ...f, isPublished: e.target.checked }))} />
            Published
          </label>
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
