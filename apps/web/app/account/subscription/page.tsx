'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import type { ApiError } from '@czd/shared-types';
import { ApiClientError, apiFetch } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { ErrorBanner, SuccessBanner } from '@/components/ErrorBanner';
import { clientError } from '@/i18n/api-errors';
import { useLocale, type TranslationKey } from '@/lib/locale-context';

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

const STATUS_LABEL: Record<CustomerSubscriptionDto['status'], TranslationKey> = {
  active: 'subscription.statusActive',
  cancelled: 'subscription.statusCancelled',
  lapsed: 'subscription.statusLapsed',
};

// Kept as data rather than a pre-built English sentence so it renders in the active language.
type SuccessNotice = { kind: 'cancelled' } | { kind: 'changed'; proratedChargePkr: number };

// docs/specs/2026-08-28-09-subscriptions-credits.md §5 — /account/subscription: current
// subscription, cancel (AC-4), change plan (AC-9).
export default function AccountSubscriptionPage() {
  const router = useRouter();
  const { user, accessToken, isReady } = useAuth();
  const { t, formatDate } = useLocale();
  const [subscription, setSubscription] = useState<CustomerSubscriptionDto | null | undefined>(undefined); // undefined = loading, null = none
  const [plans, setPlans] = useState<SubscriptionPlanDto[] | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [actionError, setActionError] = useState<ApiError | null>(null);
  const [successMessage, setSuccessMessage] = useState<SuccessNotice | null>(null);
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
        setError(err instanceof ApiClientError ? err.error : clientError('errors.loadSubscriptionFailed'));
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
      setSuccessMessage({ kind: 'cancelled' });
    } catch (err) {
      setActionError(err instanceof ApiClientError ? err.error : clientError('errors.cancelSubscriptionFailed'));
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
      setSuccessMessage({ kind: 'changed', proratedChargePkr: res.proratedChargePkr });
    } catch (err) {
      setActionError(err instanceof ApiClientError ? err.error : clientError('errors.changePlanFailed'));
    } finally {
      setBusy(false);
    }
  }

  if (!isReady || !user) return null;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-brand-navy">{t('subscription.title')}</h1>
      </div>

      <ErrorBanner error={error} />
      {successMessage && (
        <SuccessBanner
          message={
            successMessage.kind === 'cancelled'
              ? t('subscription.cancelledNotice')
              : t('subscription.changedNotice', { amount: String(successMessage.proratedChargePkr) })
          }
        />
      )}
      <ErrorBanner error={actionError} />

      {subscription === undefined ? (
        <p className="text-center text-sm text-gray-500">{t('common.loading')}</p>
      ) : subscription === null ? (
        <div className="rounded-md border border-gray-200 px-4 py-6 text-center text-sm text-gray-500">
          <p>{t('subscription.none')}</p>
          <Link href="/pricing" className="mt-2 inline-block text-brand-navy underline">
            {t('subscription.viewPlans')}
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
                {t(STATUS_LABEL[subscription.status])}
              </span>
            </div>
            <p className="mt-1 text-sm text-gray-600">
              Rs {subscription.plan.pricePkr} / {subscription.plan.billingPeriod === 'monthly' ? t('pricing.perMonthShort') : t('pricing.perYearShort')} ·{' '}
              {t('pricing.creditsPerMonth', { count: subscription.plan.monthlyCredits })}
            </p>
            <dl className="mt-3 space-y-1 text-sm text-gray-600">
              <div className="flex justify-between">
                <dt>{t('subscription.started')}</dt>
                <dd>{formatDate(subscription.startDate)}</dd>
              </div>
              <div className="flex justify-between">
                <dt>{subscription.autoRenew ? t('subscription.renews') : t('subscription.accessUntil')}</dt>
                <dd>{formatDate(subscription.renewalDate)}</dd>
              </div>
              {subscription.endDate && (
                <div className="flex justify-between">
                  <dt>{t('subscription.ends')}</dt>
                  <dd>{formatDate(subscription.endDate)}</dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt>{t('subscription.logoDownloads')}</dt>
                <dd className={subscription.logosRemaining !== null && subscription.logosRemaining <= 3 ? 'font-semibold text-red-600' : ''}>
                  {subscription.logosRemaining === null
                    ? t('subscription.logosUsedUnlimited', { count: subscription.logosUsed })
                    : t('subscription.logosLeft', { left: subscription.logosRemaining, limit: subscription.plan.logoLimit ?? 0 })}
                </dd>
              </div>
            </dl>

            {subscription.status === 'active' && subscription.autoRenew && (
              <button
                onClick={onCancel}
                disabled={busy}
                className="mt-4 rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                {t('subscription.cancel')}
              </button>
            )}
          </div>

          {subscription.status === 'active' && plans && plans.length > 1 && (
            <div className="rounded-lg border border-gray-200 bg-white p-5">
              <h3 className="text-sm font-semibold text-brand-navy">{t('subscription.changePlan')}</h3>
              <p className="mt-1 text-xs text-gray-500">{t('subscription.prorated')}</p>
              <div className="mt-3 flex gap-2">
                <select
                  value={selectedPlanId}
                  onChange={(e) => setSelectedPlanId(e.target.value)}
                  aria-label={t('subscription.changePlan')}
                  className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm"
                >
                  <option value="">{t('subscription.selectPlan')}</option>
                  {plans
                    .filter((p) => p.id !== subscription.plan.id)
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} — Rs {p.pricePkr}/{p.billingPeriod === 'monthly' ? t('pricing.perMonthShort') : t('pricing.perYearShort')}
                      </option>
                    ))}
                </select>
                <button
                  onClick={onChangePlan}
                  disabled={busy || !selectedPlanId}
                  className="rounded-md bg-brand-gold px-4 py-2 text-sm font-semibold text-brand-navy disabled:opacity-50"
                >
                  {t('subscription.change')}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
