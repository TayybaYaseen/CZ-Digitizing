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
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';

// Mirrors apps/api/src/files/dto/file-format.dto.ts's AllowedFileFormatDto.
interface AllowedFileFormatDto {
  id: string;
  extension: string;
  displayName: string;
  isPrivate: boolean;
  isLocked: boolean;
  isActive: boolean;
  maxFileSizeMb: number;
}

const schema = z.object({
  extension: z.string().min(1, 'required').max(20),
  displayName: z.string().min(1, 'required').max(255),
  isPrivate: z.boolean().default(false),
  maxFileSizeMb: z.coerce.number().min(1).max(250),
});
type FormValues = z.infer<typeof schema>;

// docs/specs/2026-08-28-05-private-file-management.md §5 — /admin/settings/file-formats.
// AC-13 — Admin adds a new machine-format extension without a code deploy. AC-14 — the EMB row
// renders with NO editable privacy/lock control at all (not just a disabled one): this page has no
// code path capable of sending an isPrivate/isLocked change for a locked row in the first place.
export default function FileFormatsAdminPage() {
  const router = useRouter();
  const { user, accessToken, isReady } = useAuth();
  const [formats, setFormats] = useState<AllowedFileFormatDto[] | null>(null);
  const [listError, setListError] = useState<ApiError | null>(null);
  const [apiError, setApiError] = useState<ApiError | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { isPrivate: false, maxFileSizeMb: 50 } });

  const load = useCallback(async () => {
    if (!accessToken) return;
    setListError(null);
    try {
      setFormats(await apiFetch<AllowedFileFormatDto[]>('/api/admin/settings/file-formats', { headers: { Authorization: `Bearer ${accessToken}` } }));
    } catch (err) {
      setListError(err instanceof ApiClientError ? err.error : { code: 'INTERNAL_ERROR', message: 'Failed to load file formats.', traceId: '' });
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
      await apiFetch('/api/admin/settings/file-formats', {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify(values),
      });
      setSuccessMessage(`Format "${values.extension.toUpperCase()}" added — selectable immediately, no deploy needed.`);
      reset({ extension: '', displayName: '', isPrivate: false, maxFileSizeMb: 50 });
      load();
    } catch (err) {
      setApiError(err instanceof ApiClientError ? err.error : { code: 'INTERNAL_ERROR', message: 'Failed to add format.', traceId: '' });
    }
  }

  async function onToggleActive(format: AllowedFileFormatDto) {
    try {
      await apiFetch(`/api/admin/settings/file-formats/${format.id}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ isActive: !format.isActive }),
      });
      load();
    } catch (err) {
      setListError(err instanceof ApiClientError ? err.error : { code: 'INTERNAL_ERROR', message: 'Failed to update format.', traceId: '' });
    }
  }

  if (!isReady || !user) return null;

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold text-navy-800">File Formats</h1>
        <p className="mt-1 text-sm text-gray-500">Allowed embroidery upload formats (AC-13/AC-14)</p>
      </div>

      <ErrorBanner error={listError} />
      {successMessage && <SuccessBanner message={successMessage} />}
      <ErrorBanner error={apiError} />

      <Card padding="p-0">
        {formats === null ? (
          <p className="p-4 text-sm text-gray-400">Loading…</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-xs uppercase tracking-wide text-gray-400">
                <th className="px-4 py-3 font-medium">Extension</th>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Privacy</th>
                <th className="px-4 py-3 font-medium">Max size</th>
                <th className="px-4 py-3 text-right font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {formats.map((format) => (
                <tr key={format.id} className="border-b border-gray-100 last:border-0">
                  <td className="px-4 py-3 font-semibold text-navy-800">{format.extension}</td>
                  <td className="px-4 py-3">{format.displayName}</td>
                  <td className="px-4 py-3">
                    {format.isLocked ? (
                      // AC-14 — no toggle, no button, nothing clickable here — a locked row's
                      // privacy flag is permanently fixed and this page offers no way to change it.
                      <Badge tone="danger">Permanently private (locked)</Badge>
                    ) : (
                      <Badge tone={format.isPrivate ? 'warning' : 'neutral'}>{format.isPrivate ? 'Private' : 'Public on purchase'}</Badge>
                    )}
                  </td>
                  <td className="px-4 py-3">{format.maxFileSizeMb} MB</td>
                  <td className="px-4 py-3 text-right">
                    {format.isLocked ? (
                      <span className="text-xs text-gray-400">Always active</span>
                    ) : (
                      <button onClick={() => onToggleActive(format)} className="text-xs font-semibold text-navy-800 underline">
                        {format.isActive ? 'Deactivate' : 'Activate'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Card title="Add a new format">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3" noValidate>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Extension" htmlFor="extension" error={errors.extension}>
              <input id="extension" placeholder="e.g. XXX" className={inputClass} {...register('extension')} />
            </FormField>
            <FormField label="Display name" htmlFor="displayName" error={errors.displayName}>
              <input id="displayName" placeholder="e.g. Future Format" className={inputClass} {...register('displayName')} />
            </FormField>
          </div>
          <FormField label="Max file size (MB)" htmlFor="maxFileSizeMb" error={errors.maxFileSizeMb}>
            <input id="maxFileSizeMb" type="number" className={inputClass} {...register('maxFileSizeMb')} />
          </FormField>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" {...register('isPrivate')} />
            Private (never delivered to customers directly — same treatment as EMB, but not locked)
          </label>
          <button type="submit" disabled={isSubmitting} className={submitButtonClass}>
            Add format
          </button>
        </form>
      </Card>
    </div>
  );
}
