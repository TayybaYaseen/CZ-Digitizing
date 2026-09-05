'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import type { ApiError, HomeSectionDto } from '@czd/shared-types';
import { ApiClientError, apiFetch } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { ErrorBanner, SuccessBanner } from '@/components/ErrorBanner';
import { FormField, inputClass, submitButtonClass } from '@/components/FormField';
import { DesignPickerField } from '@/components/DesignPickerField';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';

const EMPTY_FORM = { heading: '', description: '', designs: [] as { id: string; name: string }[], isPublished: true };

// docs/specs/2026-08-28-13-home-promotions-cms.md AC-1/AC-2/AC-7 (aspect A-018a).
export default function HomeSectionsAdminPage() {
  const router = useRouter();
  const { user, accessToken, isReady } = useAuth();
  const [sections, setSections] = useState<HomeSectionDto[] | null>(null);
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
      setSections(await apiFetch<HomeSectionDto[]>('/api/home/sections', { headers: { Authorization: `Bearer ${accessToken}` } }));
    } catch (err) {
      setListError(err instanceof ApiClientError ? err.error : { code: 'INTERNAL_ERROR', message: 'Failed to load home sections.', traceId: '' });
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

  function startEdit(section: HomeSectionDto) {
    setEditingId(section.id);
    setForm({ heading: section.heading, description: section.description ?? '', designs: section.designs.map((d) => ({ id: d.id, name: d.name })), isPublished: section.isPublished });
  }

  async function onSubmit() {
    setApiError(null);
    setSuccessMessage(null);
    if (form.designs.length === 0) {
      setApiError({ code: 'VALIDATION_ERROR', message: 'Add at least one design.', traceId: '' });
      return;
    }
    setBusy(true);
    try {
      const body = { heading: form.heading, description: form.description || undefined, designIds: form.designs.map((d) => d.id), isPublished: form.isPublished };
      if (editingId) {
        await apiFetch(`/api/admin/home/sections/${editingId}`, { method: 'PUT', headers: { Authorization: `Bearer ${accessToken}` }, body: JSON.stringify(body) });
        setSuccessMessage('Section updated.');
      } else {
        await apiFetch('/api/admin/home/sections', { method: 'POST', headers: { Authorization: `Bearer ${accessToken}` }, body: JSON.stringify(body) });
        setSuccessMessage('Section created.');
      }
      setEditingId(null);
      setForm(EMPTY_FORM);
      load();
    } catch (err) {
      setApiError(err instanceof ApiClientError ? err.error : { code: 'INTERNAL_ERROR', message: 'Failed to save section.', traceId: '' });
    } finally {
      setBusy(false);
    }
  }

  async function onDelete(id: string) {
    try {
      await apiFetch(`/api/admin/home/sections/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${accessToken}` } });
      load();
    } catch (err) {
      setListError(err instanceof ApiClientError ? err.error : { code: 'INTERNAL_ERROR', message: 'Failed to delete.', traceId: '' });
    }
  }

  async function move(index: number, direction: -1 | 1) {
    if (!sections) return;
    const next = [...sections];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target]!, next[index]!];
    setSections(next);
    try {
      await apiFetch('/api/admin/home/sections/reorder', {
        method: 'PUT',
        headers: { Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ items: next.map((s, i) => ({ id: s.id, sortOrder: i })) }),
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
        <h1 className="font-display text-3xl font-bold text-navy-800">Home Sections</h1>
        <p className="mt-1 text-sm text-gray-500">{sections?.length ?? 0} sections</p>
      </div>

      <ErrorBanner error={listError} />
      {successMessage && <SuccessBanner message={successMessage} />}

      <Card padding="p-0">
        {sections === null ? (
          <p className="p-4 text-sm text-gray-400">Loading…</p>
        ) : sections.length === 0 ? (
          <p className="p-4 text-sm text-gray-400">No sections yet.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-xs uppercase tracking-wide text-gray-400">
                <th className="px-4 py-3 font-medium">Heading</th>
                <th className="px-4 py-3 font-medium">Designs</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 text-right font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {sections.map((section, i) => (
                <tr key={section.id} className="border-b border-gray-100 last:border-0">
                  <td className="px-4 py-3 font-semibold text-navy-800">{section.heading}</td>
                  <td className="px-4 py-3">{section.designs.length}</td>
                  <td className="px-4 py-3">
                    <Badge tone={section.isPublished ? 'success' : 'warning'}>{section.isPublished ? 'Published' : 'Draft'}</Badge>
                  </td>
                  <td className="px-4 py-3 text-right space-x-1">
                    <Button variant="outlineNavy" size="sm" onClick={() => move(i, -1)} disabled={i === 0}>
                      ↑
                    </Button>
                    <Button variant="outlineNavy" size="sm" onClick={() => move(i, 1)} disabled={i === sections.length - 1}>
                      ↓
                    </Button>
                    <Button variant="outlineNavy" size="sm" onClick={() => startEdit(section)}>
                      Edit
                    </Button>
                    <Button variant="outlineNavy" size="sm" onClick={() => onDelete(section.id)}>
                      Delete
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Card title={editingId ? 'Edit section' : 'Create section'}>
        <div className="space-y-3">
          <FormField label="Heading" htmlFor="heading">
            <input id="heading" className={inputClass} value={form.heading} onChange={(e) => setForm((f) => ({ ...f, heading: e.target.value }))} />
          </FormField>
          <FormField label="Description (optional)" htmlFor="description">
            <textarea id="description" rows={2} className={inputClass} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
          </FormField>
          <FormField label="Designs" htmlFor="designs">
            <DesignPickerField selected={form.designs} onChange={(designs) => setForm((f) => ({ ...f, designs }))} accessToken={accessToken} />
          </FormField>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={form.isPublished} onChange={(e) => setForm((f) => ({ ...f, isPublished: e.target.checked }))} />
            Published
          </label>
          <ErrorBanner error={apiError} />
          <div className="flex gap-2">
            <button type="button" disabled={busy} onClick={onSubmit} className={submitButtonClass}>
              {editingId ? 'Save changes' : 'Create section'}
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
