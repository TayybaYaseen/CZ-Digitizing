'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import type { ApiError, LanguageDto } from '@czd/shared-types';
import { ApiClientError, apiFetch } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { ErrorBanner, SuccessBanner } from '@/components/ErrorBanner';
import { FormField, inputClass, submitButtonClass } from '@/components/FormField';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';

const schema = z.object({
  code: z.string().min(2, 'required'),
  name: z.string().min(1, 'required'),
  nativeName: z.string().min(1, 'required'),
  isRtl: z.boolean().default(false),
  isEnabled: z.boolean().default(true),
  sortOrder: z.coerce.number().min(0).default(0),
});
type FormValues = z.infer<typeof schema>;

// docs/specs/2026-08-28-16-internationalization.md AC-6 (aspect A-021) — adding/enabling a
// language is a plain data write here, never a schema migration or deploy.
export default function LanguagesAdminPage() {
  const router = useRouter();
  const { user, accessToken, isReady } = useAuth();
  const [languages, setLanguages] = useState<LanguageDto[] | null>(null);
  const [listError, setListError] = useState<ApiError | null>(null);
  const [apiError, setApiError] = useState<ApiError | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [editingCode, setEditingCode] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { isRtl: false, isEnabled: true, sortOrder: 0 } });

  const load = useCallback(async () => {
    if (!accessToken) return;
    setListError(null);
    try {
      setLanguages(await apiFetch<LanguageDto[]>('/api/admin/settings/languages?include_disabled=true', { headers: { Authorization: `Bearer ${accessToken}` } }));
    } catch (err) {
      setListError(err instanceof ApiClientError ? err.error : { code: 'INTERNAL_ERROR', message: 'Failed to load languages.', traceId: '' });
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

  function startEdit(lang: LanguageDto) {
    setEditingCode(lang.code);
    reset({ code: lang.code, name: lang.name, nativeName: lang.nativeName, isRtl: lang.isRtl, isEnabled: lang.isEnabled, sortOrder: lang.sortOrder });
  }

  function resetForm() {
    setEditingCode(null);
    reset({ code: '', name: '', nativeName: '', isRtl: false, isEnabled: true, sortOrder: 0 });
  }

  async function onSubmit(values: FormValues) {
    setApiError(null);
    setSuccessMessage(null);
    try {
      await apiFetch(`/api/admin/settings/languages/${values.code}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ name: values.name, nativeName: values.nativeName, isRtl: values.isRtl, isEnabled: values.isEnabled, sortOrder: values.sortOrder }),
      });
      setSuccessMessage(editingCode ? 'Language updated.' : 'Language added.');
      resetForm();
      load();
    } catch (err) {
      setApiError(err instanceof ApiClientError ? err.error : { code: 'INTERNAL_ERROR', message: 'Failed to save language.', traceId: '' });
    }
  }

  async function toggleEnabled(lang: LanguageDto) {
    try {
      await apiFetch(`/api/admin/settings/languages/${lang.code}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ name: lang.name, nativeName: lang.nativeName, isRtl: lang.isRtl, isEnabled: !lang.isEnabled, sortOrder: lang.sortOrder }),
      });
      load();
    } catch (err) {
      setListError(err instanceof ApiClientError ? err.error : { code: 'INTERNAL_ERROR', message: 'Failed to update.', traceId: '' });
    }
  }

  if (!isReady || !user) return null;

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold text-navy-800">Languages</h1>
        <p className="mt-1 text-sm text-gray-500">{languages?.length ?? 0} languages configured</p>
      </div>

      <ErrorBanner error={listError} />
      {successMessage && <SuccessBanner message={successMessage} />}

      <Card padding="p-0">
        {languages === null ? (
          <p className="p-4 text-sm text-gray-400">Loading…</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-xs uppercase tracking-wide text-gray-400">
                <th className="px-4 py-3 font-medium">Code</th>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">RTL</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 text-right font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {languages.map((lang) => (
                <tr key={lang.code} className="border-b border-gray-100 last:border-0">
                  <td className="px-4 py-3 font-mono text-xs">{lang.code}</td>
                  <td className="px-4 py-3 font-semibold text-navy-800">
                    {lang.name} <span className="text-gray-400">({lang.nativeName})</span>
                  </td>
                  <td className="px-4 py-3">{lang.isRtl ? <Badge tone="warning">RTL</Badge> : '—'}</td>
                  <td className="px-4 py-3">
                    <button onClick={() => toggleEnabled(lang)}>
                      <Badge tone={lang.isEnabled ? 'success' : 'warning'}>{lang.isEnabled ? 'Enabled' : 'Disabled'}</Badge>
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button variant="outlineNavy" size="sm" onClick={() => startEdit(lang)}>
                      Edit
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Card title={editingCode ? `Edit ${editingCode}` : 'Add language'}>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3" noValidate>
          <div className="grid grid-cols-2 gap-2">
            <FormField label="Code (ISO 639-1, e.g. fr)" htmlFor="code" error={errors.code}>
              <input id="code" className={inputClass} disabled={!!editingCode} {...register('code')} />
            </FormField>
            <FormField label="Sort order" htmlFor="sortOrder" error={errors.sortOrder}>
              <input id="sortOrder" type="number" className={inputClass} {...register('sortOrder')} />
            </FormField>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <FormField label="Name (English)" htmlFor="name" error={errors.name}>
              <input id="name" className={inputClass} {...register('name')} />
            </FormField>
            <FormField label="Native name" htmlFor="nativeName" error={errors.nativeName}>
              <input id="nativeName" className={inputClass} {...register('nativeName')} />
            </FormField>
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" {...register('isRtl')} />
            Right-to-left
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" {...register('isEnabled')} />
            Enabled
          </label>
          <ErrorBanner error={apiError} />
          <div className="flex gap-2">
            <button type="submit" disabled={isSubmitting} className={submitButtonClass}>
              {editingCode ? 'Save changes' : 'Add language'}
            </button>
            {editingCode && (
              <Button type="button" variant="outlineNavy" onClick={resetForm}>
                Cancel
              </Button>
            )}
          </div>
        </form>
      </Card>
    </div>
  );
}
