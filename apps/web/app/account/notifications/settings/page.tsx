'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import type { ApiError, NotificationPreferenceDto } from '@czd/shared-types';
import { ApiClientError, apiFetch } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { ErrorBanner, SuccessBanner } from '@/components/ErrorBanner';

function humanize(value: string) {
  return value.replace(/_/g, ' ');
}

// docs/specs/2026-08-28-02-notifications-system.md AC-9 — dedicated notification preference center
// (per-type, per-channel), split out from the notification list at /account/notifications and
// distinct from the one-click-unsubscribe landing page at /account/notifications/preferences (that
// URL is a public, tokenized redirect target for email links — it is NOT this page; see its own
// doc comment). Covers every channel the platform actually supports (email/whatsapp/in_app/push/
// sms), data-driven from whatever GET /api/notifications/preferences returns — never hardcoded here.
export default function NotificationSettingsPage() {
  const router = useRouter();
  const { user, accessToken, isReady } = useAuth();

  const [preferences, setPreferences] = useState<NotificationPreferenceDto[] | null>(null);
  const [prefError, setPrefError] = useState<ApiError | null>(null);
  const [prefSuccess, setPrefSuccess] = useState<string | null>(null);
  const [savingPrefs, setSavingPrefs] = useState(false);

  const loadPreferences = useCallback(async () => {
    if (!accessToken) return;
    setPrefError(null);
    try {
      const matrix = await apiFetch<NotificationPreferenceDto[]>('/api/notifications/preferences', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      setPreferences(matrix);
    } catch (err) {
      setPrefError(
        err instanceof ApiClientError ? err.error : { code: 'INTERNAL_ERROR', message: 'Failed to load preferences.', traceId: '' },
      );
    }
  }, [accessToken]);

  useEffect(() => {
    if (!isReady) return; // still checking localStorage — don't redirect prematurely
    if (!user) {
      router.replace('/login');
      return;
    }
    loadPreferences();
  }, [isReady, user, loadPreferences, router]);

  function togglePreference(notificationType: string, channel: string) {
    setPreferences((prev) =>
      prev?.map((p) => (p.notificationType === notificationType && p.channel === channel ? { ...p, enabled: !p.enabled } : p)) ?? null,
    );
  }

  async function onSavePreferences() {
    if (!preferences) return;
    setSavingPrefs(true);
    setPrefError(null);
    setPrefSuccess(null);
    try {
      await apiFetch('/api/notifications/preferences', {
        method: 'PUT',
        headers: { Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ preferences }),
      });
      setPrefSuccess('Preferences saved.');
    } catch (err) {
      setPrefError(
        err instanceof ApiClientError ? err.error : { code: 'INTERNAL_ERROR', message: 'Failed to save preferences.', traceId: '' },
      );
    } finally {
      setSavingPrefs(false);
    }
  }

  if (!isReady || !user) return null; // still checking localStorage, or redirecting to /login

  // Group the flat type×channel matrix by notificationType for a compact toggle grid.
  const groupedPrefs = preferences
    ? Array.from(new Set(preferences.map((p) => p.notificationType))).map((type) => ({
        type,
        entries: preferences.filter((p) => p.notificationType === type),
      }))
    : [];

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link href="/account/notifications" className="text-sm text-slate-500 hover:underline">
          &larr; Back to notifications
        </Link>
        <h1 className="mt-2 text-2xl font-bold">Notification preferences</h1>
        <p className="mt-1 text-sm text-gray-500">Choose which channels you want to hear from us on, per notification type.</p>
      </div>

      {prefSuccess && <SuccessBanner message={prefSuccess} />}
      <ErrorBanner error={prefError} onRetry={preferences === null ? loadPreferences : undefined} />

      {preferences === null && !prefError ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : preferences === null ? null : (
        <div className="space-y-2">
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase text-gray-500">
                  <th className="px-4 py-2">Type</th>
                  <th className="px-4 py-2">Channel</th>
                  <th className="px-4 py-2">Enabled</th>
                </tr>
              </thead>
              <tbody>
                {groupedPrefs.map(({ type, entries }) =>
                  entries.map((entry, idx) => (
                    <tr key={`${entry.notificationType}:${entry.channel}`} className="border-b border-slate-100 last:border-0">
                      {idx === 0 && (
                        <td className="px-4 py-2 align-top font-medium text-gray-900" rowSpan={entries.length}>
                          {humanize(type)}
                        </td>
                      )}
                      <td className="px-4 py-2 text-gray-600">{humanize(entry.channel)}</td>
                      <td className="px-4 py-2">
                        <input
                          type="checkbox"
                          checked={entry.enabled}
                          onChange={() => togglePreference(entry.notificationType, entry.channel)}
                        />
                      </td>
                    </tr>
                  )),
                )}
              </tbody>
            </table>
          </div>

          <button
            onClick={onSavePreferences}
            disabled={savingPrefs}
            className="rounded-lg bg-brand-navy px-4 py-2 text-sm font-semibold text-white hover:bg-brand-navyLight disabled:cursor-not-allowed disabled:opacity-50"
          >
            {savingPrefs ? 'Saving…' : 'Save preferences'}
          </button>
        </div>
      )}
    </div>
  );
}
