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

// Mirrors apps/api/prisma/schema.prisma's AdminModule/AdminAccessLevel enums exactly.
const ADMIN_MODULES = [
  'designs', 'categories', 'bundles', 'orders', 'quotes', 'custom_requests', 'faqs',
  'testimonials', 'blog', 'portfolio', 'subscriptions', 'credits', 'notifications', 'settings',
] as const;
const ACCESS_LEVELS = ['read_only', 'crud'] as const;

interface PermissionGrant {
  module: (typeof ADMIN_MODULES)[number];
  accessLevel: (typeof ACCESS_LEVELS)[number];
}

interface FreelancerAccount {
  id: string;
  email: string;
  displayName: string | null;
  role: 'freelancer' | 'moderator';
  permissions: { module: string; accessLevel: string }[];
}

const schema = z.object({
  email: z.string().email('email must be an email'),
  role: z.enum(['freelancer', 'moderator']),
  displayName: z.string().max(255).optional().or(z.literal('')),
});

type FormValues = z.infer<typeof schema>;

export default function FreelancerAccountsPage() {
  const router = useRouter();
  const { user, accessToken, isReady } = useAuth();
  const [accounts, setAccounts] = useState<FreelancerAccount[] | null>(null);
  const [listError, setListError] = useState<ApiError | null>(null);
  const [permissions, setPermissions] = useState<PermissionGrant[]>([]);
  const [apiError, setApiError] = useState<ApiError | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
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
      const list = await apiFetch<FreelancerAccount[]>('/api/admin/freelancer-accounts', {
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

  if (!isReady || !user) return null; // still checking localStorage, or redirecting to /login

  return (
    <div className="mx-auto max-w-3xl space-y-10">
      <div>
        <h1 className="text-2xl font-bold">Freelancer &amp; limited-admin accounts</h1>
        <p className="mt-1 text-sm text-gray-400">
          Scoped accounts with read-only or CRUD access to specific modules. Revoking immediately
          invalidates their active sessions (AC-8).
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Existing accounts</h2>
        <ErrorBanner error={listError} />
        {accounts === null ? (
          <p className="text-sm text-gray-400">Loading…</p>
        ) : accounts.length === 0 ? (
          <p className="text-sm text-gray-400">No freelancer accounts yet.</p>
        ) : (
          <ul className="divide-y divide-gray-800 rounded-md border border-gray-800">
            {accounts.map((account) => (
              <li key={account.id} className="flex items-center justify-between gap-4 px-4 py-3">
                <div>
                  <p className="text-sm font-medium">{account.email}</p>
                  <p className="text-xs text-gray-400">
                    {account.role} — {account.permissions.map((p) => `${p.module}:${p.accessLevel}`).join(', ') || 'no active permissions'}
                  </p>
                </div>
                <button
                  onClick={() => onRevoke(account.id)}
                  className="rounded-md border border-red-900 px-3 py-1 text-xs text-red-300 hover:bg-red-950"
                >
                  Revoke
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Create account</h2>
        {successMessage && <SuccessBanner message={successMessage} />}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <ErrorBanner error={apiError} />

          <FormField label="Email" htmlFor="email" error={errors.email}>
            <input id="email" type="email" className={inputClass} {...register('email')} />
          </FormField>

          <FormField label="Display name (optional)" htmlFor="displayName" error={errors.displayName}>
            <input id="displayName" type="text" className={inputClass} {...register('displayName')} />
          </FormField>

          <fieldset className="space-y-1">
            <legend className="text-sm font-medium text-gray-300">Role</legend>
            <label className="mr-4 text-sm text-gray-300">
              <input type="radio" value="freelancer" className="mr-1" {...register('role')} /> Freelancer
            </label>
            <label className="text-sm text-gray-300">
              <input type="radio" value="moderator" className="mr-1" {...register('role')} /> Moderator
            </label>
          </fieldset>

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium text-gray-300">Module permissions</legend>
            <div className="grid grid-cols-2 gap-2">
              {ADMIN_MODULES.map((module) => {
                const grant = permissions.find((p) => p.module === module);
                return (
                  <div key={module} className="flex items-center justify-between rounded-md border border-gray-800 px-2 py-1.5">
                    <label className="text-sm text-gray-300">
                      <input type="checkbox" checked={!!grant} onChange={() => togglePermission(module)} className="mr-2" />
                      {module}
                    </label>
                    {grant && (
                      <select
                        value={grant.accessLevel}
                        onChange={(e) => setPermissionLevel(module, e.target.value as PermissionGrant['accessLevel'])}
                        className="rounded border border-gray-700 bg-gray-900 text-xs text-gray-100"
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
          </fieldset>

          <button type="submit" disabled={isSubmitting} className={submitButtonClass}>
            {isSubmitting ? 'Creating…' : 'Create account'}
          </button>
        </form>
      </section>
    </div>
  );
}
