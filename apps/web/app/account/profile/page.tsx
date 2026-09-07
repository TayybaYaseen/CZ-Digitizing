'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import type { ApiError } from '@czd/shared-types';
import { ApiClientError, apiFetch } from '@/lib/api-client';
import { useAuth, type AuthUser } from '@/lib/auth-context';
import { ErrorBanner } from '@/components/ErrorBanner';

// docs/specs/2026-08-28-14-customer-account-history.md §3/§5 (aspect A-019), AC-3. Editing here
// only ever writes to the users row (PUT /api/users/profile, POST /api/users/avatar) — it never
// touches historical quotes/orders/custom-request records, which keep whatever identity info they
// captured at submission time by construction (the backend simply has no write path from here to
// those tables).
export default function ProfilePage() {
  const router = useRouter();
  const { user, accessToken, isReady, updateUser } = useAuth();
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState<ApiError | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isReady) return;
    if (!user) router.replace('/login');
    else setDisplayName(user.displayName ?? '');
  }, [isReady, user, router]);

  if (!isReady || !user) return null;

  async function saveProfile() {
    if (!accessToken) return;
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const updated = await apiFetch<AuthUser>('/api/users/profile', {
        method: 'PUT',
        headers: { Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ displayName: displayName.trim() || undefined }),
      });
      updateUser(updated);
      setSaved(true);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.error : { code: 'INTERNAL_ERROR', message: 'Could not save your profile.', traceId: '' });
    } finally {
      setBusy(false);
    }
  }

  async function uploadAvatar(file: File) {
    if (!accessToken) return;
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      form.append('file', file);
      const updated = await apiFetch<AuthUser>('/api/users/avatar', {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
        body: form,
      });
      updateUser(updated);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.error : { code: 'INTERNAL_ERROR', message: 'Could not upload your avatar.', traceId: '' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Profile</h1>
        <p className="mt-1 text-sm text-gray-600">Display name and avatar — your email and orders stay the same.</p>
      </div>

      <ErrorBanner error={error} />

      <div className="flex items-center gap-4">
        {user.avatarUrl ? (
          <img src={user.avatarUrl} alt="" className="h-16 w-16 rounded-full object-cover" />
        ) : (
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gray-100 text-lg font-semibold text-gray-500">
            {(user.displayName ?? user.email)[0]?.toUpperCase()}
          </div>
        )}
        <div>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={busy}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50"
          >
            Change avatar
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void uploadAvatar(file);
              e.target.value = '';
            }}
          />
        </div>
      </div>

      <div className="space-y-3 rounded-lg border border-gray-200 bg-white p-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Email</label>
          <p className="mt-1 text-sm text-gray-500">{user.email}</p>
        </div>
        <div>
          <label htmlFor="displayName" className="block text-sm font-medium text-gray-700">
            Display name
          </label>
          <input
            id="displayName"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={saveProfile}
            disabled={busy}
            className="rounded-md bg-brand-gold px-4 py-2 text-sm font-semibold text-brand-navy disabled:opacity-50"
          >
            Save
          </button>
          {saved && <span className="text-sm text-emerald-600">Saved</span>}
        </div>
      </div>
    </div>
  );
}
