'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import type { ApiError } from '@czd/shared-types';
import { ApiClientError, apiFetch } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { ErrorBanner, SuccessBanner } from '@/components/ErrorBanner';

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

// Mirrors apps/api/src/subscriptions/dto/subscription.dto.ts's CustomerSubscriptionDto.
interface CustomerSubscriptionDto {
  id: string;
  plan: SubscriptionPlanDto;
  status: 'active' | 'cancelled' | 'lapsed';
  autoRenew: boolean;
  startDate: string;
  renewalDate: string;
  endDate: string | null;
  logosUsed: number;
  logosRemaining: number | null;
}

const STATUS_LABEL: Record<CustomerSubscriptionDto['status'], string> = {
  active: 'Active',
  cancelled: 'Cancelled',
  lapsed: 'Lapsed',
};

// docs/specs/2026-08-28-09-subscriptions-credits.md §5 — /account/subscription: current
// subscription, cancel (AC-4), change plan (AC-9).
export default function AccountSubscriptionPage() {
  const router = useRouter();
  const { user, accessToken, isReady } = useAuth();
  const [subscription, setSubscription] = useState<CustomerSubscriptionDto | null | undefined>(undefined); // undefined = loading, null = none
  const [plans, setPlans] = useState<SubscriptionPlanDto[] | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [actionError, setActionError] = useState<ApiError | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState('');

  const load = useCallback(async () => {
    if (!accessToken) return;
    try {
      const current = await apiFetch<CustomerSubscriptionDto>('/api/subscriptions/current', { headers: { Authorization: `Bearer ${accessToken}` } });
      setSubscription(current);
    } catch (err) {
      if (err instanceof ApiClientError && err.error.code === 'RESOURCE_NOT_FOUND') {
        setSubscription(null);
      } else {
        setError(err instanceof ApiClientError ? err.error : { code: 'INTERNAL_ERROR', message: 'Could not load subscription.', traceId: '' });
      }
    }
  }, [accessToken]);

  useEffect(() => {
    if (isReady && !user) router.replace('/login');
  }, [isReady, user, router]);

  useEffect(() => {
    if (!user || !accessToken) return;
    load();
    apiFetch<SubscriptionPlanDto[]>('/api/subscriptions/plans')
      .then((all) => setPlans(all.filter((p) => p.isPublished)))
      .catch(() => setPlans([]));
  }, [user, accessToken, load]);

  async function onCancel() {
    setActionError(null);
    setSuccessMessage(null);
    setBusy(true);
    try {
      const updated = await apiFetch<CustomerSubscriptionDto>('/api/subscriptions/cancel', {
        method: 'PUT',
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      setSubscription(updated);
      setSuccessMessage('Subscription cancelled. Your perks remain active until the end of the current billing period.');
    } catch (err) {
      setActionError(err instanceof ApiClientError ? err.error : { code: 'INTERNAL_ERROR', message: 'Could not cancel subscription.', traceId: '' });
    } finally {
      setBusy(false);
    }
  }

  async function onChangePlan() {
    if (!selectedPlanId) return;
    setActionError(null);
    setSuccessMessage(null);
    setBusy(true);
    try {
      const res = await apiFetch<{ subscription: CustomerSubscriptionDto; proratedChargePkr: number }>('/api/subscriptions/change-plan', {
        method: 'PUT',
        headers: { Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ planId: selectedPlanId }),
      });
      setSubscription(res.subscription);
      setSuccessMessage(`Plan changed. Prorated charge for the remainder of this cycle: Rs ${res.proratedChargePkr}.`);
    } catch (err) {
      setActionError(err instanceof ApiClientError ? err.error : { code: 'INTERNAL_ERROR', message: 'Could not change plan.', traceId: '' });
    } finally {
      setBusy(false);
    }
  }

  if (!isReady || !user) return null;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-brand-navy">My Subscription</h1>
      </div>

      <ErrorBanner error={error} />
      {successMessage && <SuccessBanner message={successMessage} />}
      <ErrorBanner error={actionError} />

      {subscription === undefined ? (
        <p className="text-center text-sm text-gray-500">Loading…</p>
      ) : subscription === null ? (
        <div className="rounded-md border border-gray-200 px-4 py-6 text-center text-sm text-gray-500">
          <p>You don&apos;t have an active subscription.</p>
          <Link href="/pricing" className="mt-2 inline-block text-brand-navy underline">
            View plans
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="rounded-lg border border-gray-200 bg-white p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-brand-navy">{subscription.plan.name}</h2>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                  subscription.status === 'active'
                    ? 'bg-emerald-100 text-emerald-700'
                    : subscription.status === 'lapsed'
                      ? 'bg-red-100 text-red-700'
                      : 'bg-gray-200 text-gray-700'
                }`}
              >
                {STATUS_LABEL[subscription.status]}
              </span>
            </div>
            <p className="mt-1 text-sm text-gray-600">
              Rs {subscription.plan.pricePkr} / {subscription.plan.billingPeriod === 'monthly' ? 'mo' : 'yr'} · {subscription.plan.monthlyCredits}{' '}
              credits/month
            </p>
            <dl className="mt-3 space-y-1 text-sm text-gray-600">
              <div className="flex justify-between">
                <dt>Started</dt>
                <dd>{new Date(subscription.startDate).toLocaleDateString()}</dd>
              </div>
              <div className="flex justify-between">
                <dt>{subscription.autoRenew ? 'Renews' : 'Access until'}</dt>
                <dd>{new Date(subscription.renewalDate).toLocaleDateString()}</dd>
              </div>
              {subscription.endDate && (
                <div className="flex justify-between">
                  <dt>Ends</dt>
                  <dd>{new Date(subscription.endDate).toLocaleDateString()}</dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt>Logo downloads</dt>
                <dd className={subscription.logosRemaining !== null && subscription.logosRemaining <= 3 ? 'font-semibold text-red-600' : ''}>
                  {subscription.logosRemaining === null
                    ? `${subscription.logosUsed} used (unlimited)`
                    : `${subscription.logosRemaining} left of ${subscription.plan.logoLimit}`}
                </dd>
              </div>
            </dl>

            {subscription.status === 'active' && subscription.autoRenew && (
              <button
                onClick={onCancel}
                disabled={busy}
                className="mt-4 rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel subscription
              </button>
            )}
          </div>

          {subscription.status === 'active' && plans && plans.length > 1 && (
            <div className="rounded-lg border border-gray-200 bg-white p-5">
              <h3 className="text-sm font-semibold text-brand-navy">Change plan</h3>
              <p className="mt-1 text-xs text-gray-500">Price difference for the remainder of this cycle is prorated (AC-9).</p>
              <div className="mt-3 flex gap-2">
                <select
                  value={selectedPlanId}
                  onChange={(e) => setSelectedPlanId(e.target.value)}
                  className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm"
                >
                  <option value="">Select a plan…</option>
                  {plans
                    .filter((p) => p.id !== subscription.plan.id)
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} — Rs {p.pricePkr}/{p.billingPeriod === 'monthly' ? 'mo' : 'yr'}
                      </option>
                    ))}
                </select>
                <button
                  onClick={onChangePlan}
                  disabled={busy || !selectedPlanId}
                  className="rounded-md bg-brand-gold px-4 py-2 text-sm font-semibold text-brand-navy disabled:opacity-50"
                >
                  Change
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
