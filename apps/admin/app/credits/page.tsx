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
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';

// Mirrors apps/api/src/credits/dto/credit-package.dto.ts's CreditPackageDto.
interface CreditPackageDto {
  id: string;
  name: string;
  credits: number;
  bonusCredits: number;
  pricePkr: number;
  isPublished: boolean;
}

const schema = z.object({
  name: z.string().min(1, 'required').max(255),
  credits: z.coerce.number().min(0),
  bonusCredits: z.coerce.number().min(0).default(0),
  pricePkr: z.coerce.number().min(0),
  isPublished: z.boolean().default(true),
});
type FormValues = z.infer<typeof schema>;

const EMPTY: FormValues = { name: '', credits: 0, bonusCredits: 0, pricePkr: 0, isPublished: true };

// docs/specs/2026-08-28-09-subscriptions-credits.md AC-5 — admin credit package CRUD. Same shape
// as apps/admin/app/pricing (no DELETE route in the API contract — unpublish instead of delete;
// "Edit" populates the form and submit becomes a PUT).
//
// Hits 'api/credits/admin/packages*' rather than 'api/credits/packages' — that literal path
// collided with CreditsController's own public @Get('packages'), which silently swallowed every
// GET here, so this page could never actually see a draft/unpublished package. See
// credits-admin.controller.ts's own comment on the same fix (same bug as the pricing page had).
export default function CreditsAdminPage() {
  const router = useRouter();
  const { user, accessToken, isReady } = useAuth();
  const [packages, setPackages] = useState<CreditPackageDto[] | null>(null);
  const [listError, setListError] = useState<ApiError | null>(null);
  const [apiError, setApiError] = useState<ApiError | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: EMPTY });

  const load = useCallback(async () => {
    if (!accessToken) return;
    setListError(null);
    try {
      const list = await apiFetch<CreditPackageDto[]>('/api/credits/admin/packages', { headers: { Authorization: `Bearer ${accessToken}` } });
      setPackages(list);
    } catch (err) {
      setListError(err instanceof ApiClientError ? err.error : { code: 'INTERNAL_ERROR', message: 'Failed to load credit packages.', traceId: '' });
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

  function onEdit(pkg: CreditPackageDto) {
    setEditingId(pkg.id);
    setSuccessMessage(null);
    reset({ name: pkg.name, credits: pkg.credits, bonusCredits: pkg.bonusCredits, pricePkr: pkg.pricePkr, isPublished: pkg.isPublished });
  }

  function onCancelEdit() {
    setEditingId(null);
    reset(EMPTY);
  }

  async function onDelete(pkg: CreditPackageDto) {
    if (!window.confirm(`Delete package "${pkg.name}"? This cannot be undone.`)) return;
    setApiError(null);
    setSuccessMessage(null);
    try {
      await apiFetch(`/api/credits/admin/packages/${pkg.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${accessToken}` } });
      setSuccessMessage(`Package "${pkg.name}" deleted.`);
      if (editingId === pkg.id) {
        setEditingId(null);
        reset(EMPTY);
      }
      load();
    } catch (err) {
      setApiError(err instanceof ApiClientError ? err.error : { code: 'INTERNAL_ERROR', message: 'Failed to delete package.', traceId: '' });
    }
  }

  async function onSubmit(values: FormValues) {
    setApiError(null);
    setSuccessMessage(null);
    const body = {
      name: values.name,
      credits: values.credits,
      bonusCredits: values.bonusCredits,
      pricePkr: values.pricePkr,
      isPublished: values.isPublished,
    };
    try {
      if (editingId) {
        await apiFetch(`/api/credits/admin/packages/${editingId}`, {
          method: 'PUT',
          headers: { Authorization: `Bearer ${accessToken}` },
          body: JSON.stringify(body),
        });
        setSuccessMessage(`Package "${values.name}" updated.`);
      } else {
        await apiFetch('/api/credits/admin/packages', {
          method: 'POST',
          headers: { Authorization: `Bearer ${accessToken}` },
          body: JSON.stringify(body),
        });
        setSuccessMessage(`Package "${values.name}" created.`);
      }
      setEditingId(null);
      reset(EMPTY);
      load();
    } catch (err) {
      setApiError(err instanceof ApiClientError ? err.error : { code: 'INTERNAL_ERROR', message: 'Failed to save package.', traceId: '' });
    }
  }

  if (!isReady || !user) return null;

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold text-navy-800">Credit Packages</h1>
        <p className="mt-1 text-sm text-gray-500">{packages?.length ?? 0} packages (AC-5)</p>
      </div>

      <ErrorBanner error={listError} />
      {successMessage && <SuccessBanner message={successMessage} />}
      <ErrorBanner error={apiError} />

      <Card padding="p-0">
        {packages === null ? (
          <p className="p-4 text-sm text-gray-400">Loading…</p>
        ) : packages.length === 0 ? (
          <p className="p-4 text-sm text-gray-400">No credit packages yet.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-xs uppercase tracking-wide text-gray-400">
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Credits</th>
                <th className="px-4 py-3 font-medium">Bonus</th>
                <th className="px-4 py-3 font-medium">Price</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 text-right font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {packages.map((pkg) => (
                <tr key={pkg.id} className="border-b border-gray-100 last:border-0">
                  <td className="px-4 py-3 font-semibold text-navy-800">{pkg.name}</td>
                  <td className="px-4 py-3">{pkg.credits}</td>
                  <td className="px-4 py-3">{pkg.bonusCredits}</td>
                  <td className="px-4 py-3">Rs {pkg.pricePkr}</td>
                  <td className="px-4 py-3">
                    <Badge tone={pkg.isPublished ? 'success' : 'warning'}>{pkg.isPublished ? 'Published' : 'Draft'}</Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="outlineNavy" size="sm" onClick={() => onEdit(pkg)}>
                        Edit
                      </Button>
                      <Button variant="outlineNavy" size="sm" className="!border-red-300 !text-red-600 hover:!bg-red-50" onClick={() => onDelete(pkg)}>
                        Delete
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Card title={editingId ? 'Edit package' : 'Create package'}>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3" noValidate>
          <FormField label="Name" htmlFor="name" error={errors.name}>
            <input id="name" className={inputClass} {...register('name')} />
          </FormField>
          <div className="grid grid-cols-3 gap-2">
            <FormField label="Credits" htmlFor="credits" error={errors.credits}>
              <input id="credits" type="number" className={inputClass} {...register('credits')} />
            </FormField>
            <FormField label="Bonus credits" htmlFor="bonusCredits" error={errors.bonusCredits}>
              <input id="bonusCredits" type="number" className={inputClass} {...register('bonusCredits')} />
            </FormField>
            <FormField label="Price (PKR)" htmlFor="pricePkr" error={errors.pricePkr}>
              <input id="pricePkr" type="number" step="0.01" className={inputClass} {...register('pricePkr')} />
            </FormField>
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" {...register('isPublished')} />
            Published
          </label>
          <div className="flex gap-2">
            <button type="submit" disabled={isSubmitting} className={submitButtonClass}>
              {editingId ? 'Save changes' : 'Create package'}
            </button>
            {editingId && (
              <Button type="button" variant="outlineNavy" onClick={onCancelEdit}>
                Cancel
              </Button>
            )}
          </div>
        </form>
      </Card>
    </div>
  );
}
