'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { ApiError } from '@czd/shared-types';
import { ApiClientError, apiFetch } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { ErrorBanner } from '@/components/ErrorBanner';

interface AccountMemberDto {
  id: string;
  email: string;
  displayName: string | null;
  invitedAt: string;
  acceptedAt: string | null;
}

// docs/specs/2026-08-28-14-customer-account-history.md §3/§5 (aspect A-019), AC-7. The invitee
// must already have their own registered CZ Digitizing login — see AccountService's own doc
// comment for why this is the minimal-viable reading of AC-7, not a full invite-by-email-to-a-new-
// signup flow.
export default function AccountMembersPage() {
  const router = useRouter();
  const { user, accessToken, isReady } = useAuth();
  const [members, setMembers] = useState<AccountMemberDto[] | null>(null);
  const [email, setEmail] = useState('');
  const [error, setError] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!isReady) return;
    if (!user) router.replace('/login');
  }, [isReady, user, router]);

  function load() {
    if (!accessToken) return;
    apiFetch<AccountMemberDto[]>('/api/users/account-members', { headers: { Authorization: `Bearer ${accessToken}` } })
      .then(setMembers)
      .catch((err) => setError(err instanceof ApiClientError ? err.error : { code: 'INTERNAL_ERROR', message: 'Could not load members.', traceId: '' }));
  }

  useEffect(() => {
    if (!user || !accessToken) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, accessToken]);

  if (!isReady || !user) return null;

  async function invite() {
    if (!accessToken || !email.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await apiFetch('/api/users/account-members', {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ email: email.trim() }),
      });
      setEmail('');
      load();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.error : { code: 'INTERNAL_ERROR', message: 'Could not add that member.', traceId: '' });
    } finally {
      setBusy(false);
    }
  }

  async function revoke(id: string) {
    if (!accessToken) return;
    try {
      await apiFetch(`/api/users/account-members/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${accessToken}` } });
      load();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.error : { code: 'INTERNAL_ERROR', message: 'Could not remove that member.', traceId: '' });
    }
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Shared Account Members</h1>
        <p className="mt-1 text-sm text-gray-600">
          Give someone else their own login to your order/quote/purchase history — e.g. a colleague at a small business. They must already have
          their own registered CZ Digitizing account.
        </p>
      </div>

      <ErrorBanner error={error} />

      <div className="flex gap-2">
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="colleague@example.com"
          type="email"
          className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
        <button onClick={invite} disabled={busy || !email.trim()} className="rounded-md bg-brand-gold px-4 py-2 text-sm font-semibold text-brand-navy disabled:opacity-50">
          Invite
        </button>
      </div>

      {members === null ? (
        <p className="text-center text-sm text-gray-500">Loading…</p>
      ) : members.length === 0 ? (
        <p className="text-sm text-gray-500">No members yet — invite a colleague above.</p>
      ) : (
        <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white">
          {members.map((m) => (
            <li key={m.id} className="flex items-center justify-between px-4 py-3 text-sm">
              <div>
                <p className="font-medium">{m.displayName ?? m.email}</p>
                <p className="text-xs text-gray-500">{m.email}</p>
              </div>
              <button onClick={() => revoke(m.id)} className="text-xs text-red-600 underline">
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
