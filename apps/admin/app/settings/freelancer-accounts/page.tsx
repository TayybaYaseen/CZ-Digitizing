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
import { Card } from '@/components/ui/Card';

// Mirrors apps/api/prisma/schema.prisma's AdminModule enum exactly (A-005f fix — this list had
// drifted to 14 of the 21 real values, so several modules could never be granted from this UI).
const ADMIN_MODULES = [
  'designs', 'categories', 'services', 'bundles', 'orders', 'quotes', 'custom_requests', 'faqs',
  'taebo', 'tips', 'testimonials', 'blog', 'about', 'portfolio', 'subscriptions', 'credits',
  'notifications', 'settings', 'home_sections', 'advertisements', 'header_media',
] as const;
const ACCESS_LEVELS = ['read_only', 'crud'] as const;

interface PermissionGrant {
  module: (typeof ADMIN_MODULES)[number];
  accessLevel: (typeof ACCESS_LEVELS)[number];
}

interface StaffAccount {
  id: string;
  email: string;
  displayName: string | null;
  role: 'admin' | 'freelancer' | 'moderator';
  permissions: { module: string; accessLevel: string }[];
}

interface SessionInfo {
  id: string;
  deviceId: string;
  ipAddress: string | null;
  userAgent: string | null;
  isVerified: boolean;
  createdAt: string;
  lastActivityAt: string;
}

const schema = z.object({
  email: z.string().email('email must be an email'),
  role: z.enum(['freelancer', 'moderator']),
  displayName: z.string().max(255).optional().or(z.literal('')),
});

type FormValues = z.infer<typeof schema>;

function PermissionPicker({
  permissions,
  onToggle,
  onLevelChange,
}: {
  permissions: PermissionGrant[];
  onToggle: (module: PermissionGrant['module']) => void;
  onLevelChange: (module: PermissionGrant['module'], accessLevel: PermissionGrant['accessLevel']) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {ADMIN_MODULES.map((module) => {
        const grant = permissions.find((p) => p.module === module);
        return (
          <div key={module} className="flex items-center justify-between rounded-field border border-gray-200 px-2 py-1.5">
            <label className="text-sm text-gray-700">
              <input type="checkbox" checked={!!grant} onChange={() => onToggle(module)} className="mr-2" />
              {module}
            </label>
            {grant && (
              <select
                value={grant.accessLevel}
                onChange={(e) => onLevelChange(module, e.target.value as PermissionGrant['accessLevel'])}
                className="rounded border border-gray-300 bg-white text-xs text-gray-700"
              >
                {ACCESS_LEVELS.map((level) => (
                  <option key={level} value={level}>
                    {level}
                  </option>
                ))}
              </select>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function FreelancerAccountsPage() {
  const router = useRouter();
  const { user, accessToken, isReady } = useAuth();
  const [accounts, setAccounts] = useState<StaffAccount[] | null>(null);
  const [listError, setListError] = useState<ApiError | null>(null);
  const [permissions, setPermissions] = useState<PermissionGrant[]>([]);
  const [apiError, setApiError] = useState<ApiError | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // A-005f — editing an existing account's permissions.
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editPermissions, setEditPermissions] = useState<PermissionGrant[]>([]);
  const [editError, setEditError] = useState<ApiError | null>(null);
  const [editSaving, setEditSaving] = useState(false);

  // A-005f — Active Sessions.
  const [sessionsForId, setSessionsForId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<SessionInfo[] | null>(null);
  const [sessionsError, setSessionsError] = useState<ApiError | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { role: 'freelancer' } });

  const loadAccounts = useCallback(async () => {
    if (!accessToken) return;
    try {
      const list = await apiFetch<StaffAccount[]>('/api/admin/freelancer-accounts', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      setAccounts(list);
    } catch (err) {
      setListError(err instanceof ApiClientError ? err.error : { code: 'INTERNAL_ERROR', message: 'Failed to load accounts.', traceId: '' });
    }
  }, [accessToken]);

  useEffect(() => {
    if (!isReady) return; // still checking localStorage — don't redirect prematurely
    if (!user) {
      router.replace('/login');
      return;
    }
    loadAccounts();
  }, [isReady, user, loadAccounts, router]);

  function togglePermission(module: PermissionGrant['module']) {
    setPermissions((prev) =>
      prev.some((p) => p.module === module)
        ? prev.filter((p) => p.module !== module)
        : [...prev, { module, accessLevel: 'read_only' }],
    );
  }

  function setPermissionLevel(module: PermissionGrant['module'], accessLevel: PermissionGrant['accessLevel']) {
    setPermissions((prev) => prev.map((p) => (p.module === module ? { ...p, accessLevel } : p)));
  }

  async function onSubmit(values: FormValues) {
    setApiError(null);
    setSuccessMessage(null);

    if (permissions.length === 0) {
      setApiError({ code: 'VALIDATION_ERROR', message: 'Select at least one module permission.', traceId: '' });
      return;
    }

    try {
      await apiFetch('/api/admin/freelancer-accounts', {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ ...values, displayName: values.displayName || undefined, permissions }),
      });
      setSuccessMessage(`Account created for ${values.email} — they'll get an email to set their password.`);
      reset({ email: '', role: 'freelancer', displayName: '' });
      setPermissions([]);
      loadAccounts();
    } catch (err) {
      if (err instanceof ApiClientError) {
        if (err.error.code === 'VALIDATION_ERROR' && err.error.errors) {
          for (const fieldError of err.error.errors) {
            setError(fieldError.field as keyof FormValues, { message: fieldError.message });
          }
        } else {
          setApiError(err.error);
        }
      } else {
        setApiError({ code: 'INTERNAL_ERROR', message: 'Something went wrong. Please try again.', traceId: '' });
      }
    }
  }

  async function onRevoke(id: string) {
    try {
      await apiFetch(`/api/admin/freelancer-accounts/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      loadAccounts();
    } catch (err) {
      setListError(err instanceof ApiClientError ? err.error : { code: 'INTERNAL_ERROR', message: 'Failed to revoke.', traceId: '' });
    }
  }

  function startEdit(account: StaffAccount) {
    setEditingId(account.id);
    setEditError(null);
    setEditPermissions(account.permissions.map((p) => ({ module: p.module as PermissionGrant['module'], accessLevel: p.accessLevel as PermissionGrant['accessLevel'] })));
    setSessionsForId(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditPermissions([]);
    setEditError(null);
  }

  function toggleEditPermission(module: PermissionGrant['module']) {
    setEditPermissions((prev) =>
      prev.some((p) => p.module === module) ? prev.filter((p) => p.module !== module) : [...prev, { module, accessLevel: 'read_only' }],
    );
  }

  function setEditPermissionLevel(module: PermissionGrant['module'], accessLevel: PermissionGrant['accessLevel']) {
    setEditPermissions((prev) => prev.map((p) => (p.module === module ? { ...p, accessLevel } : p)));
  }

  async function saveEdit(id: string) {
    setEditError(null);
    if (editPermissions.length === 0) {
      setEditError({ code: 'VALIDATION_ERROR', message: 'Select at least one module permission.', traceId: '' });
      return;
    }
    setEditSaving(true);
    try {
      await apiFetch(`/api/admin/freelancer-accounts/${id}/permissions`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ permissions: editPermissions }),
      });
      cancelEdit();
      loadAccounts();
    } catch (err) {
      setEditError(err instanceof ApiClientError ? err.error : { code: 'INTERNAL_ERROR', message: 'Failed to save permissions.', traceId: '' });
    } finally {
      setEditSaving(false);
    }
  }

  async function toggleSessions(id: string) {
    if (sessionsForId === id) {
      setSessionsForId(null);
      setSessions(null);
      return;
    }
    setSessionsForId(id);
    setSessions(null);
    setSessionsError(null);
    setEditingId(null);
    try {
      const list = await apiFetch<SessionInfo[]>(`/api/admin/freelancer-accounts/${id}/sessions`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      setSessions(list);
    } catch (err) {
      setSessionsError(err instanceof ApiClientError ? err.error : { code: 'INTERNAL_ERROR', message: 'Failed to load sessions.', traceId: '' });
    }
  }

  async function onRevokeSession(accountId: string, sessionId: string) {
    try {
      await apiFetch(`/api/admin/freelancer-accounts/${accountId}/sessions/${sessionId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      setSessions((prev) => prev?.filter((s) => s.id !== sessionId) ?? null);
    } catch (err) {
      setSessionsError(err instanceof ApiClientError ? err.error : { code: 'INTERNAL_ERROR', message: 'Failed to revoke session.', traceId: '' });
    }
  }

  if (!isReady || !user) return null; // still checking localStorage, or redirecting to /login

  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <h1 className="font-display text-3xl font-bold text-navy-800">Admin Users, Roles &amp; Active Sessions</h1>
        <p className="mt-1 text-sm text-gray-500">
          Every account with panel access: the primary Admin role (read-only here), plus scoped
          freelancer/moderator accounts you can edit or revoke. Revoking a freelancer/moderator
          account immediately invalidates its active sessions (AC-8).
        </p>
      </div>

      <Card title="Accounts" padding="p-0">
        <div className="p-4 pb-0">
          <ErrorBanner error={listError} />
        </div>
        {accounts === null ? (
          <p className="p-4 text-sm text-gray-400">Loading…</p>
        ) : accounts.length === 0 ? (
          <p className="p-4 text-sm text-gray-400">No accounts yet.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {accounts.map((account) => (
              <li key={account.id} className="px-4 py-3">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-navy-800">{account.email}</p>
                    <p className="text-xs text-gray-500">
                      {account.role}
                      {account.role === 'admin'
                        ? ' — full access'
                        : ` — ${account.permissions.map((p) => `${p.module}:${p.accessLevel}`).join(', ') || 'no active permissions'}`}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <button
                      onClick={() => toggleSessions(account.id)}
                      className="rounded-field border border-gray-300 px-3 py-1 text-xs text-gray-700 hover:bg-gray-50"
                    >
                      {sessionsForId === account.id ? 'Hide sessions' : 'Sessions'}
                    </button>
                    {account.role !== 'admin' && (
                      <>
                        <button
                          onClick={() => startEdit(account)}
                          className="rounded-field border border-gray-300 px-3 py-1 text-xs text-gray-700 hover:bg-gray-50"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => onRevoke(account.id)}
                          className="rounded-field border border-status-redFg/30 px-3 py-1 text-xs text-status-redFg hover:bg-status-redBg"
                        >
                          Revoke
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {editingId === account.id && (
                  <div className="mt-3 rounded-field border border-gray-200 bg-gray-50 p-3">
                    <ErrorBanner error={editError} />
                    <PermissionPicker permissions={editPermissions} onToggle={toggleEditPermission} onLevelChange={setEditPermissionLevel} />
                    <div className="mt-3 flex gap-2">
                      <button
                        onClick={() => saveEdit(account.id)}
                        disabled={editSaving}
                        className="rounded-field bg-navy-800 px-3 py-1.5 text-xs font-medium text-white hover:bg-navy-700 disabled:opacity-50"
                      >
                        {editSaving ? 'Saving…' : 'Save permissions'}
                      </button>
                      <button onClick={cancelEdit} className="rounded-field border border-gray-300 px-3 py-1.5 text-xs text-gray-700 hover:bg-white">
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {sessionsForId === account.id && (
                  <div className="mt-3 rounded-field border border-gray-200 bg-gray-50 p-3">
                    <ErrorBanner error={sessionsError} />
                    {sessions === null ? (
                      <p className="text-xs text-gray-400">Loading sessions…</p>
                    ) : sessions.length === 0 ? (
                      <p className="text-xs text-gray-400">No active sessions.</p>
                    ) : (
                      <ul className="space-y-2">
                        {sessions.map((s) => (
                          <li key={s.id} className="flex items-center justify-between gap-3 rounded border border-gray-200 bg-white px-2 py-1.5">
                            <div className="text-xs text-gray-600">
                              <p>{s.userAgent ?? 'Unknown device'} {s.ipAddress ? `— ${s.ipAddress}` : ''}</p>
                              <p className="text-gray-400">
                                {s.isVerified ? 'Trusted' : 'Pending verification'} · last active {new Date(s.lastActivityAt).toLocaleString()}
                              </p>
                            </div>
                            <button
                              onClick={() => onRevokeSession(account.id, s.id)}
                              className="shrink-0 rounded-field border border-status-redFg/30 px-2 py-1 text-xs text-status-redFg hover:bg-status-redBg"
                            >
                              Revoke
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="Create account">
        {successMessage && <SuccessBanner message={successMessage} />}

        <form onSubmit={handleSubmit(onSubmit)} className="mt-3 space-y-4" noValidate>
          <ErrorBanner error={apiError} />

          <FormField label="Email" htmlFor="email" error={errors.email}>
            <input id="email" type="email" className={inputClass} {...register('email')} />
          </FormField>

          <FormField label="Display name (optional)" htmlFor="displayName" error={errors.displayName}>
            <input id="displayName" type="text" className={inputClass} {...register('displayName')} />
          </FormField>

          <fieldset className="space-y-1">
            <legend className="text-sm font-medium text-gray-600">Role</legend>
            <label className="mr-4 text-sm text-gray-700">
              <input type="radio" value="freelancer" className="mr-1" {...register('role')} /> Freelancer
            </label>
            <label className="text-sm text-gray-700">
              <input type="radio" value="moderator" className="mr-1" {...register('role')} /> Moderator
            </label>
          </fieldset>

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium text-gray-600">Module permissions</legend>
            <PermissionPicker permissions={permissions} onToggle={togglePermission} onLevelChange={setPermissionLevel} />
          </fieldset>

          <button type="submit" disabled={isSubmitting} className={submitButtonClass}>
            {isSubmitting ? 'Creating…' : 'Create account'}
          </button>
        </form>
      </Card>
    </div>
  );
}
