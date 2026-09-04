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

// Mirrors apps/api/src/subscriptions/dto/subscription.dto.ts's SubscriptionPlanDto.
interface SubscriptionPlanDto {
  id: string;
  name: string;
  billingPeriod: 'monthly' | 'yearly';
  pricePkr: number;
  monthlyCredits: number;
  logoLimit: number | null;
  perks: string[];
  isBestValue: boolean;
  isPublished: boolean;
}

// Mirrors SubscriptionUsageDto — one row per subscriber, Admin-only.
interface SubscriptionUsageDto {
  customerId: string;
  customerEmail: string;
  planName: string;
  status: 'active' | 'cancelled' | 'lapsed';
  logoLimit: number | null;
  logosUsed: number;
  logosRemaining: number | null;
}

const schema = z.object({
  name: z.string().min(1, 'required').max(255),
  billingPeriod: z.enum(['monthly', 'yearly']),
  pricePkr: z.coerce.number().min(0),
  monthlyCredits: z.coerce.number().min(0),
  // Blank = unlimited (sent to the API as null, not 0 — 0 would mean "no downloads allowed").
  logoLimitText: z.string().optional(),
  perksText: z.string().optional(),
  isBestValue: z.boolean().default(false),
  isPublished: z.boolean().default(true),
});
type FormValues = z.infer<typeof schema>;

const EMPTY: FormValues = {
  name: '',
  billingPeriod: 'monthly',
  pricePkr: 0,
  monthlyCredits: 0,
  logoLimitText: '',
  perksText: '',
  isBestValue: false,
  isPublished: true,
};

// docs/specs/2026-08-28-09-subscriptions-credits.md AC-1 — admin subscription plan CRUD, plus the
// plan's logo/design-file download allowance and per-customer usage visibility (added on top of
// the spec at Admin's request — a plan can cap how many logo downloads it grants per cycle, and
// Admin needs to see how much of that each subscriber has used/has left). DELETE isn't in the
// spec's own API contract (§3: only GET/POST/PUT), but was added at Admin's request too — the
// service refuses it with a clear message when the plan has ever had a subscriber (unpublishing is
// still the right move there; delete is only for a plan created by mistake with zero subscribers).
// Editing reuses the create form (no existing edit-modal precedent elsewhere in apps/admin to
// follow instead): selecting "Edit" on a row populates the form and submit does PUT instead of POST.
//
// List/create/update now hit 'api/subscriptions/admin/plans*' rather than 'api/subscriptions/plans'
// — that literal path collided with SubscriptionsController's public @Get('plans'), which silently
// swallowed every GET here (Express/Nest resolve duplicate paths by registration order), so this
// page could never actually see draft/unpublished plans despite the permission gate looking correct
// in the controller code. See subscriptions-admin.controller.ts's own comment on the same fix.
export default function PricingAdminPage() {
  const router = useRouter();
  const { user, accessToken, isReady } = useAuth();
  const [plans, setPlans] = useState<SubscriptionPlanDto[] | null>(null);
  const [usage, setUsage] = useState<SubscriptionUsageDto[] | null>(null);
  const [listError, setListError] = useState<ApiError | null>(null);
  const [usageError, setUsageError] = useState<ApiError | null>(null);
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
      const list = await apiFetch<SubscriptionPlanDto[]>('/api/subscriptions/admin/plans', { headers: { Authorization: `Bearer ${accessToken}` } });
      setPlans(list);
    } catch (err) {
      // Server-enforced RequiresPermission('subscriptions', ...) — surface a 403 like any other
      // load failure rather than special-casing it; ErrorBanner already renders the message.
      setListError(err instanceof ApiClientError ? err.error : { code: 'INTERNAL_ERROR', message: 'Failed to load plans.', traceId: '' });
    }
  }, [accessToken]);

  const loadUsage = useCallback(async () => {
    if (!accessToken) return;
    setUsageError(null);
    try {
      const list = await apiFetch<SubscriptionUsageDto[]>('/api/subscriptions/admin/usage', { headers: { Authorization: `Bearer ${accessToken}` } });
      setUsage(list);
    } catch (err) {
      setUsageError(err instanceof ApiClientError ? err.error : { code: 'INTERNAL_ERROR', message: 'Failed to load usage.', traceId: '' });
    }
  }, [accessToken]);

  useEffect(() => {
    if (!isReady) return;
    if (!user) {
      router.replace('/login');
      return;
    }
    load();
    loadUsage();
  }, [isReady, user, load, loadUsage, router]);

  function onEdit(plan: SubscriptionPlanDto) {
    setEditingId(plan.id);
    setSuccessMessage(null);
    reset({
      name: plan.name,
      billingPeriod: plan.billingPeriod,
      pricePkr: plan.pricePkr,
      monthlyCredits: plan.monthlyCredits,
      logoLimitText: plan.logoLimit === null ? '' : String(plan.logoLimit),
      perksText: plan.perks.join('\n'),
      isBestValue: plan.isBestValue,
      isPublished: plan.isPublished,
    });
  }

  function onCancelEdit() {
    setEditingId(null);
    reset(EMPTY);
  }

  async function onDelete(plan: SubscriptionPlanDto) {
    if (!window.confirm(`Delete plan "${plan.name}"? This cannot be undone.`)) return;
    setApiError(null);
    setSuccessMessage(null);
    try {
      await apiFetch(`/api/subscriptions/admin/plans/${plan.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${accessToken}` } });
      setSuccessMessage(`Plan "${plan.name}" deleted.`);
      if (editingId === plan.id) {
        setEditingId(null);
        reset(EMPTY);
      }
      load();
    } catch (err) {
      // CONFLICT (409) — plan has subscribers, deletion is refused rather than corrupting their
      // history (see SubscriptionsService.deletePlan()'s own comment). The error message already
      // explains why and suggests unpublishing instead.
      setApiError(err instanceof ApiClientError ? err.error : { code: 'INTERNAL_ERROR', message: 'Failed to delete plan.', traceId: '' });
    }
  }

  async function onSubmit(values: FormValues) {
    setApiError(null);
    setSuccessMessage(null);
    const logoLimitTrimmed = (values.logoLimitText ?? '').trim();
    const body = {
      name: values.name,
      billingPeriod: values.billingPeriod,
      pricePkr: values.pricePkr,
      monthlyCredits: values.monthlyCredits,
      logoLimit: logoLimitTrimmed === '' ? null : Number(logoLimitTrimmed),
      perks: (values.perksText ?? '')
        .split('\n')
        .map((p) => p.trim())
        .filter(Boolean),
      isBestValue: values.isBestValue,
      isPublished: values.isPublished,
    };
    try {
      if (editingId) {
        await apiFetch(`/api/subscriptions/admin/plans/${editingId}`, {
          method: 'PUT',
          headers: { Authorization: `Bearer ${accessToken}` },
          body: JSON.stringify(body),
        });
        setSuccessMessage(`Plan "${values.name}" updated.`);
      } else {
        await apiFetch('/api/subscriptions/admin/plans', {
          method: 'POST',
          headers: { Authorization: `Bearer ${accessToken}` },
          body: JSON.stringify(body),
        });
        setSuccessMessage(`Plan "${values.name}" created.`);
      }
      setEditingId(null);
      reset(EMPTY);
      load();
    } catch (err) {
      setApiError(err instanceof ApiClientError ? err.error : { code: 'INTERNAL_ERROR', message: 'Failed to save plan.', traceId: '' });
    }
  }

  if (!isReady || !user) return null;

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold text-navy-800">Subscription Plans</h1>
        <p className="mt-1 text-sm text-gray-500">{plans?.length ?? 0} plans (AC-1) — create as many as you like.</p>
      </div>

      <ErrorBanner error={listError} />
      {successMessage && <SuccessBanner message={successMessage} />}
      <ErrorBanner error={apiError} />

      <Card padding="p-0">
        {plans === null ? (
          <p className="p-4 text-sm text-gray-400">Loading…</p>
        ) : plans.length === 0 ? (
          <p className="p-4 text-sm text-gray-400">No plans yet.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-xs uppercase tracking-wide text-gray-400">
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Billing</th>
                <th className="px-4 py-3 font-medium">Price</th>
                <th className="px-4 py-3 font-medium">Credits/mo</th>
                <th className="px-4 py-3 font-medium">Logo limit</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 text-right font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {plans.map((plan) => (
                <tr key={plan.id} className="border-b border-gray-100 last:border-0">
                  <td className="px-4 py-3 font-semibold text-navy-800">
                    {plan.name} {plan.isBestValue && <Badge tone="gold">Best Value</Badge>}
                  </td>
                  <td className="px-4 py-3 capitalize">{plan.billingPeriod}</td>
                  <td className="px-4 py-3">Rs {plan.pricePkr}</td>
                  <td className="px-4 py-3">{plan.monthlyCredits}</td>
                  <td className="px-4 py-3">{plan.logoLimit === null ? 'Unlimited' : `${plan.logoLimit} / mo`}</td>
                  <td className="px-4 py-3">
                    <Badge tone={plan.isPublished ? 'success' : 'warning'}>{plan.isPublished ? 'Published' : 'Draft'}</Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="outlineNavy" size="sm" onClick={() => onEdit(plan)}>
                        Edit
                      </Button>
                      <Button variant="outlineNavy" size="sm" className="!border-red-300 !text-red-600 hover:!bg-red-50" onClick={() => onDelete(plan)}>
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

      <Card title={editingId ? 'Edit plan' : 'Create plan'}>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3" noValidate>
          <FormField label="Name" htmlFor="name" error={errors.name}>
            <input id="name" className={inputClass} {...register('name')} />
          </FormField>
          <div className="grid grid-cols-2 gap-2">
            <FormField label="Billing period" htmlFor="billingPeriod" error={errors.billingPeriod}>
              <select id="billingPeriod" className={inputClass} {...register('billingPeriod')}>
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
              </select>
            </FormField>
            <FormField label="Price (PKR)" htmlFor="pricePkr" error={errors.pricePkr}>
              <input id="pricePkr" type="number" step="0.01" className={inputClass} {...register('pricePkr')} />
            </FormField>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <FormField label="Monthly credits" htmlFor="monthlyCredits" error={errors.monthlyCredits}>
              <input id="monthlyCredits" type="number" className={inputClass} {...register('monthlyCredits')} />
            </FormField>
            <FormField label="Logo download limit / mo (blank = unlimited)" htmlFor="logoLimitText" error={errors.logoLimitText}>
              <input id="logoLimitText" type="number" min={0} placeholder="Unlimited" className={inputClass} {...register('logoLimitText')} />
            </FormField>
          </div>
          <FormField label="Perks (one per line)" htmlFor="perksText" error={errors.perksText}>
            <textarea id="perksText" rows={3} className={inputClass} {...register('perksText')} />
          </FormField>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" {...register('isBestValue')} />
            Best value
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" {...register('isPublished')} />
            Published
          </label>
          <div className="flex gap-2">
            <button type="submit" disabled={isSubmitting} className={submitButtonClass}>
              {editingId ? 'Save changes' : 'Create plan'}
            </button>
            {editingId && (
              <Button type="button" variant="outlineNavy" onClick={onCancelEdit}>
                Cancel
              </Button>
            )}
          </div>
        </form>
      </Card>

      <div>
        <h2 className="font-display text-xl font-bold text-navy-800">Customer Logo Usage</h2>
        <p className="mt-1 text-sm text-gray-500">How many logo downloads each subscriber has used and has left this cycle.</p>
      </div>

      <ErrorBanner error={usageError} />

      <Card padding="p-0">
        {usage === null ? (
          <p className="p-4 text-sm text-gray-400">Loading…</p>
        ) : usage.length === 0 ? (
          <p className="p-4 text-sm text-gray-400">No subscribers yet.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-xs uppercase tracking-wide text-gray-400">
                <th className="px-4 py-3 font-medium">Customer</th>
                <th className="px-4 py-3 font-medium">Plan</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Used</th>
                <th className="px-4 py-3 font-medium">Remaining</th>
              </tr>
            </thead>
            <tbody>
              {usage.map((row) => {
                const low = row.logosRemaining !== null && row.logosRemaining <= 3;
                return (
                  <tr key={row.customerId} className="border-b border-gray-100 last:border-0">
                    <td className="px-4 py-3 font-semibold text-navy-800">{row.customerEmail}</td>
                    <td className="px-4 py-3">{row.planName}</td>
                    <td className="px-4 py-3">
                      <Badge tone={row.status === 'active' ? 'success' : row.status === 'lapsed' ? 'danger' : 'warning'}>{row.status}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      {row.logosUsed}
                      {row.logoLimit !== null ? ` / ${row.logoLimit}` : ''}
                    </td>
                    <td className="px-4 py-3">
                      {row.logosRemaining === null ? (
                        'Unlimited'
                      ) : (
                        <span className={low ? 'font-semibold text-red-600' : ''}>{row.logosRemaining} left</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
