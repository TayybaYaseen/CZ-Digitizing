'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { AdvertisementDto, ApiError } from '@czd/shared-types';
import { ApiClientError, apiFetch } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { ErrorBanner, SuccessBanner } from '@/components/ErrorBanner';
import { FormField, inputClass, submitButtonClass } from '@/components/FormField';
import { DesignPickerField } from '@/components/DesignPickerField';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';

const EMPTY_FORM = {
  heading: '',
  subheading: '',
  offerText: '',
  bannerImageUrl: '',
  ctaText: '',
  ctaLink: '',
  startDate: '',
  endDate: '',
  isActive: true,
  targetDesigns: [] as { id: string; name: string }[],
};

function toDateTimeLocal(iso: string) {
  return iso ? new Date(iso).toISOString().slice(0, 16) : '';
}

// docs/specs/2026-08-28-13-home-promotions-cms.md AC-3/AC-4/AC-5 (aspect A-018b). Targeting is
// "specific designs" only in this admin UI — category targeting can be added later without an API
// change (targetCategoryId already exists server-side); the "category OR designs" conflict is
// enforced by AdvertisementsService regardless of which the UI offers first.
export default function AdvertisementsAdminPage() {
  const router = useRouter();
  const { user, accessToken, isReady } = useAuth();
  const [ads, setAds] = useState<AdvertisementDto[] | null>(null);
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
      setAds(await apiFetch<AdvertisementDto[]>('/api/admin/advertisements', { headers: { Authorization: `Bearer ${accessToken}` } }));
    } catch (err) {
      setListError(err instanceof ApiClientError ? err.error : { code: 'INTERNAL_ERROR', message: 'Failed to load advertisements.', traceId: '' });
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

  async function startEdit(ad: AdvertisementDto) {
    setEditingId(ad.id);
    const targetDesigns = await Promise.all(
      ad.targetDesignIds.map((id) =>
        apiFetch<{ id: string; name: string }>(`/api/designs/${id}`, { headers: { Authorization: `Bearer ${accessToken}` } }).catch(() => ({ id, name: `#${id}` })),
      ),
    );
    setForm({
      heading: ad.heading,
      subheading: ad.subheading ?? '',
      offerText: ad.offerText ?? '',
      bannerImageUrl: ad.bannerImageUrl ?? '',
      ctaText: ad.ctaText ?? '',
      ctaLink: ad.ctaLink ?? '',
      startDate: toDateTimeLocal(ad.startDate),
      endDate: toDateTimeLocal(ad.endDate),
      isActive: true,
      targetDesigns,
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
      setForm((f) => ({ ...f, bannerImageUrl: url }));
    } catch (err) {
      setApiError(err instanceof ApiClientError ? err.error : { code: 'INTERNAL_ERROR', message: 'Image upload failed.', traceId: '' });
    } finally {
      setImageUploading(false);
    }
  }

  async function onSubmit() {
    setApiError(null);
    setSuccessMessage(null);
    if (!form.startDate || !form.endDate) {
      setApiError({ code: 'VALIDATION_ERROR', message: 'Start and end dates are required.', traceId: '' });
      return;
    }
    setBusy(true);
    try {
      const body = {
        heading: form.heading,
        subheading: form.subheading || undefined,
        offerText: form.offerText || undefined,
        bannerImageUrl: form.bannerImageUrl || undefined,
        ctaText: form.ctaText || undefined,
        ctaLink: form.ctaLink || undefined,
        startDate: new Date(form.startDate).toISOString(),
        endDate: new Date(form.endDate).toISOString(),
        isActive: form.isActive,
        targetDesignIds: form.targetDesigns.map((d) => d.id),
      };
      if (editingId) {
        await apiFetch(`/api/admin/advertisements/${editingId}`, { method: 'PUT', headers: { Authorization: `Bearer ${accessToken}` }, body: JSON.stringify(body) });
        setSuccessMessage('Advertisement updated.');
      } else {
        await apiFetch('/api/admin/advertisements', { method: 'POST', headers: { Authorization: `Bearer ${accessToken}` }, body: JSON.stringify(body) });
        setSuccessMessage('Advertisement created.');
      }
      setEditingId(null);
      setForm(EMPTY_FORM);
      if (fileInputRef.current) fileInputRef.current.value = '';
      load();
    } catch (err) {
      setApiError(err instanceof ApiClientError ? err.error : { code: 'INTERNAL_ERROR', message: 'Failed to save advertisement.', traceId: '' });
    } finally {
      setBusy(false);
    }
  }

  async function onDelete(id: string) {
    try {
      await apiFetch(`/api/admin/advertisements/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${accessToken}` } });
      load();
    } catch (err) {
      setListError(err instanceof ApiClientError ? err.error : { code: 'INTERNAL_ERROR', message: 'Failed to delete.', traceId: '' });
    }
  }

  if (!isReady || !user) return null;

  const now = Date.now();

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold text-navy-800">Advertisements</h1>
        <p className="mt-1 text-sm text-gray-500">{ads?.length ?? 0} total</p>
      </div>

      <ErrorBanner error={listError} />
      {successMessage && <SuccessBanner message={successMessage} />}

      <Card padding="p-0">
        {ads === null ? (
          <p className="p-4 text-sm text-gray-400">Loading…</p>
        ) : ads.length === 0 ? (
          <p className="p-4 text-sm text-gray-400">No advertisements yet.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-xs uppercase tracking-wide text-gray-400">
                <th className="px-4 py-3 font-medium">Heading</th>
                <th className="px-4 py-3 font-medium">Window</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 text-right font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {ads.map((ad) => {
                const isLive = new Date(ad.startDate).getTime() <= now && new Date(ad.endDate).getTime() >= now;
                return (
                  <tr key={ad.id} className="border-b border-gray-100 last:border-0">
                    <td className="px-4 py-3 font-semibold text-navy-800">{ad.heading}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {new Date(ad.startDate).toLocaleDateString()} – {new Date(ad.endDate).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={isLive ? 'success' : 'neutral'}>{isLive ? 'Live' : 'Inactive'}</Badge>
                    </td>
                    <td className="px-4 py-3 text-right space-x-2">
                      <Button variant="outlineNavy" size="sm" onClick={() => startEdit(ad)}>
                        Edit
                      </Button>
                      <Button variant="outlineNavy" size="sm" onClick={() => onDelete(ad.id)}>
                        Delete
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>

      <Card title={editingId ? 'Edit advertisement' : 'Create advertisement'}>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <FormField label="Heading" htmlFor="heading">
              <input id="heading" className={inputClass} value={form.heading} onChange={(e) => setForm((f) => ({ ...f, heading: e.target.value }))} />
            </FormField>
            <FormField label="Subheading (optional)" htmlFor="subheading">
              <input id="subheading" className={inputClass} value={form.subheading} onChange={(e) => setForm((f) => ({ ...f, subheading: e.target.value }))} />
            </FormField>
          </div>
          <FormField label="Offer text (optional)" htmlFor="offerText">
            <input id="offerText" className={inputClass} value={form.offerText} onChange={(e) => setForm((f) => ({ ...f, offerText: e.target.value }))} />
          </FormField>
          <FormField label="Banner image" htmlFor="bannerImage">
            <div className="flex items-center gap-3">
              {form.bannerImageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={form.bannerImageUrl} alt="" className="h-14 w-24 rounded-field border border-gray-200 object-cover" />
              )}
              <input
                ref={fileInputRef}
                id="bannerImage"
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                disabled={imageUploading}
                onChange={(e) => onImageSelected(e.target.files)}
                className="block flex-1 text-sm text-gray-600 file:mr-3 file:rounded-field file:border-0 file:bg-gold-500 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-navy-800"
              />
            </div>
          </FormField>
          <div className="grid grid-cols-2 gap-2">
            <FormField label="CTA text (optional)" htmlFor="ctaText">
              <input id="ctaText" className={inputClass} value={form.ctaText} onChange={(e) => setForm((f) => ({ ...f, ctaText: e.target.value }))} />
            </FormField>
            <FormField label="CTA link (optional)" htmlFor="ctaLink">
              <input id="ctaLink" className={inputClass} value={form.ctaLink} onChange={(e) => setForm((f) => ({ ...f, ctaLink: e.target.value }))} />
            </FormField>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <FormField label="Start date" htmlFor="startDate">
              <input id="startDate" type="datetime-local" className={inputClass} value={form.startDate} onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))} />
            </FormField>
            <FormField label="End date" htmlFor="endDate">
              <input id="endDate" type="datetime-local" className={inputClass} value={form.endDate} onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))} />
            </FormField>
          </div>
          <FormField label="Target specific designs (optional — leave empty to target everything)" htmlFor="targetDesigns">
            <DesignPickerField selected={form.targetDesigns} onChange={(targetDesigns) => setForm((f) => ({ ...f, targetDesigns }))} accessToken={accessToken} />
          </FormField>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={form.isActive} onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))} />
            Active
          </label>
          <ErrorBanner error={apiError} />
          <div className="flex gap-2">
            <button type="button" disabled={busy} onClick={onSubmit} className={submitButtonClass}>
              {editingId ? 'Save changes' : 'Create advertisement'}
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
