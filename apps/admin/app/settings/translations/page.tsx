'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import type { ApiError, LanguageDto, TranslationBundleDto } from '@czd/shared-types';
import { ApiClientError, apiFetch } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { ErrorBanner, SuccessBanner } from '@/components/ErrorBanner';
import { inputClass, submitButtonClass } from '@/components/FormField';
import { Card } from '@/components/ui/Card';

// docs/specs/2026-08-28-16-internationalization.md AC-1/AC-6 (aspect A-021) — bulk key/value
// editor for a locale's UI-chrome strings. English rows double as the master key list, since
// every key must exist there for the fallback (AC-3) to have anything to fall back to.
export default function TranslationsAdminPage() {
  const router = useRouter();
  const { user, accessToken, isReady } = useAuth();
  const [languages, setLanguages] = useState<LanguageDto[]>([]);
  const [locale, setLocale] = useState('en');
  const [bundle, setBundle] = useState<TranslationBundleDto | null>(null);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [listError, setListError] = useState<ApiError | null>(null);
  const [apiError, setApiError] = useState<ApiError | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isReady) return;
    if (!user) {
      router.replace('/login');
      return;
    }
    if (!accessToken) return;
    apiFetch<LanguageDto[]>('/api/admin/settings/languages?include_disabled=true', { headers: { Authorization: `Bearer ${accessToken}` } })
      .then(setLanguages)
      .catch(() => setLanguages([]));
  }, [isReady, user, accessToken, router]);

  const load = useCallback(async () => {
    if (!accessToken) return;
    setListError(null);
    try {
      const data = await apiFetch<TranslationBundleDto>(`/api/admin/settings/translations/${locale}`, { headers: { Authorization: `Bearer ${accessToken}` } });
      setBundle(data);
      setEdits({});
    } catch (err) {
      setListError(err instanceof ApiClientError ? err.error : { code: 'INTERNAL_ERROR', message: 'Failed to load translations.', traceId: '' });
    }
  }, [accessToken, locale]);

  useEffect(() => {
    load();
  }, [load]);

  async function onSave() {
    if (Object.keys(edits).length === 0) return;
    setSaving(true);
    setApiError(null);
    setSuccessMessage(null);
    try {
      await apiFetch(`/api/admin/settings/translations/${locale}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ entries: edits }),
      });
      setSuccessMessage('Translations saved.');
      load();
    } catch (err) {
      setApiError(err instanceof ApiClientError ? err.error : { code: 'INTERNAL_ERROR', message: 'Failed to save translations.', traceId: '' });
    } finally {
      setSaving(false);
    }
  }

  if (!isReady || !user) return null;

  const keys = bundle ? Object.keys(bundle).sort() : [];

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold text-navy-800">UI Translations</h1>
        <p className="mt-1 text-sm text-gray-500">Edit the header/nav, cart, checkout, account, and FAQ system strings per language.</p>
      </div>

      <div className="flex items-center gap-2">
        <label htmlFor="locale" className="text-sm font-medium text-gray-700">
          Language
        </label>
        <select id="locale" value={locale} onChange={(e) => setLocale(e.target.value)} className={`${inputClass} w-40`}>
          {languages.map((lang) => (
            <option key={lang.code} value={lang.code}>
              {lang.name} ({lang.code})
            </option>
          ))}
        </select>
      </div>

      <ErrorBanner error={listError} />
      {successMessage && <SuccessBanner message={successMessage} />}

      <Card padding="p-0">
        {bundle === null ? (
          <p className="p-4 text-sm text-gray-400">Loading…</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-xs uppercase tracking-wide text-gray-400">
                <th className="px-4 py-3 font-medium">Key</th>
                <th className="px-4 py-3 font-medium">Value</th>
                <th className="px-4 py-3 font-medium">Source</th>
              </tr>
            </thead>
            <tbody>
              {keys.map((key) => (
                <tr key={key} className="border-b border-gray-100 last:border-0">
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">{key}</td>
                  <td className="px-4 py-3">
                    <input
                      className={inputClass}
                      defaultValue={bundle[key]?.value ?? ''}
                      onChange={(e) => setEdits((prev) => ({ ...prev, [key]: e.target.value }))}
                    />
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-400">{bundle[key]?.isMachineTranslated ? 'Machine translated' : 'Human'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <ErrorBanner error={apiError} />
      <button type="button" disabled={saving || Object.keys(edits).length === 0} className={submitButtonClass} onClick={onSave}>
        {saving ? 'Saving…' : 'Save changes'}
      </button>
    </div>
  );
}
