'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { ApiError } from '@czd/shared-types';
import { ApiClientError, apiFetch } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { ErrorBanner } from '@/components/ErrorBanner';

// Mirrors apps/api/src/subscriptions/dto/subscription-plan.dto.ts's SubscriptionPlanDto.
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

// Mirrors apps/api/src/credits/dto/credit-package.dto.ts's CreditPackageDto.
interface CreditPackageDto {
  id: string;
  name: string;
  credits: number;
  bonusCredits: number;
  pricePkr: number;
  isPublished: boolean;
}

type Tab = 'subscriptions' | 'credits';

// docs/specs/2026-08-28-09-subscriptions-credits.md §5 — /pricing toggles between "Subscription
// Plans" (AC-1) and "Buy Credits" (AC-5). Both lists are public (no auth needed to browse), but
// subscribing/purchasing requires login — mirrors the pattern of browsing designs vs. adding to cart.
export default function PricingPage() {
  const router = useRouter();
  const { user, accessToken } = useAuth();
  const [tab, setTab] = useState<Tab>('subscriptions');
  const [plans, setPlans] = useState<SubscriptionPlanDto[] | null>(null);
  const [packages, setPackages] = useState<CreditPackageDto[] | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [actionError, setActionError] = useState<ApiError | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<SubscriptionPlanDto[]>('/api/subscriptions/plans')
      .then(setPlans)
      .catch((err) => setError(err instanceof ApiClientError ? err.error : { code: 'INTERNAL_ERROR', message: 'Could not load plans.', traceId: '' }));
    apiFetch<CreditPackageDto[]>('/api/credits/packages')
      .then(setPackages)
      .catch((err) => setError(err instanceof ApiClientError ? err.error : { code: 'INTERNAL_ERROR', message: 'Could not load credit packages.', traceId: '' }));
  }, []);

  const publishedPlans = (plans ?? []).filter((p) => p.isPublished);
  const publishedPackages = (packages ?? []).filter((p) => p.isPublished);

  async function onSubscribe(planId: string) {
    if (!user || !accessToken) {
      router.push('/login');
      return;
    }
    setActionError(null);
    setBusyId(planId);
    try {
      const res = await apiFetch<{ approveUrl: string | null; clientSecret: string | null }>('/api/subscriptions/subscribe', {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ planId, paymentMethod: 'paypal' }),
      });
      if (res.approveUrl) {
        // PayPal subscription flow — hand off to PayPal's approval page (spec §8 risk #1 notes the
        // exact recurring-billing mechanism is still open; this follows the same one-time-capture
        // redirect shape as apps/web/app/checkout for consistency until that's resolved).
        window.location.href = res.approveUrl;
        return;
      }
      // Stripe clientSecret path: no Stripe Elements card form exists anywhere in apps/web yet
      // (checkout page's "Stripe" option is also just a radio button, no card capture UI) — same
      // deliberate simplification here. Confirming/paying the clientSecret is left as a follow-up.
      router.push('/account/subscription');
    } catch (err) {
      setActionError(err instanceof ApiClientError ? err.error : { code: 'INTERNAL_ERROR', message: 'Subscribe failed.', traceId: '' });
    } finally {
      setBusyId(null);
    }
  }

  async function onBuyCredits(packageId: string) {
    if (!user || !accessToken) {
      router.push('/login');
      return;
    }
    setActionError(null);
    setBusyId(packageId);
    try {
      const res = await apiFetch<{ approveUrl: string | null; clientSecret: string | null }>('/api/credits/purchase', {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ packageId, paymentMethod: 'paypal' }),
      });
      if (res.approveUrl) {
        window.location.href = res.approveUrl;
        return;
      }
      router.push('/account/credits');
    } catch (err) {
      setActionError(err instanceof ApiClientError ? err.error : { code: 'INTERNAL_ERROR', message: 'Purchase failed.', traceId: '' });
    } finally {
      setBusyId(null);
    }
  }

  const loading = plans === null || packages === null;
  // spec §5 Empty state — hide the corresponding toggle rather than show a blank panel.
  const showSubscriptionsTab = loading || publishedPlans.length > 0;
  const showCreditsTab = loading || publishedPackages.length > 0;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-brand-navy">Pricing</h1>
        <p className="mt-1 text-sm text-gray-600">Subscribe for monthly credits and perks, or buy a one-time credit package.</p>
      </div>

      <div className="flex gap-2 border-b border-gray-200">
        {showSubscriptionsTab && (
          <button
            onClick={() => setTab('subscriptions')}
            className={`px-4 py-2 text-sm font-semibold ${tab === 'subscriptions' ? 'border-b-2 border-brand-gold text-brand-navy' : 'text-gray-500'}`}
          >
            Subscription Plans
          </button>
        )}
        {showCreditsTab && (
          <button
            onClick={() => setTab('credits')}
            className={`px-4 py-2 text-sm font-semibold ${tab === 'credits' ? 'border-b-2 border-brand-gold text-brand-navy' : 'text-gray-500'}`}
          >
            Buy Credits
          </button>
        )}
      </div>

      <ErrorBanner error={error} />
      <ErrorBanner error={actionError} />

      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-56 animate-pulse rounded-lg bg-gray-100" />
          ))}
        </div>
      ) : tab === 'subscriptions' ? (
        publishedPlans.length === 0 ? (
          <p className="text-center text-sm text-gray-500">No subscription plans available right now.</p>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {publishedPlans.map((plan) => (
              <div
                key={plan.id}
                className={`flex flex-col justify-between rounded-lg border p-5 ${
                  plan.isBestValue ? 'border-brand-gold bg-brand-gold/5 ring-2 ring-brand-gold' : 'border-gray-200 bg-white'
                }`}
              >
                <div className="space-y-2">
                  {plan.isBestValue && (
                    <span className="inline-block rounded-full bg-brand-gold px-2 py-0.5 text-xs font-semibold text-brand-navy">Best Value</span>
                  )}
                  <h2 className="text-lg font-bold text-brand-navy">{plan.name}</h2>
                  <p className="text-2xl font-bold">
                    Rs {plan.pricePkr}
                    <span className="text-sm font-normal text-gray-500"> / {plan.billingPeriod === 'monthly' ? 'mo' : 'yr'}</span>
                  </p>
                  <p className="text-sm text-gray-600">{plan.monthlyCredits} credits / month</p>
                  <p className="text-sm text-gray-600">{plan.logoLimit === null ? 'Unlimited' : plan.logoLimit} logo downloads / month</p>
                  <ul className="space-y-1 text-sm text-gray-600">
                    {plan.perks.map((perk, i) => (
                      <li key={i}>• {perk}</li>
                    ))}
                  </ul>
                </div>
                <button
                  onClick={() => onSubscribe(plan.id)}
                  disabled={busyId === plan.id}
                  className="mt-4 w-full rounded-md bg-brand-gold px-4 py-2 text-sm font-semibold text-brand-navy disabled:opacity-50"
                >
                  {busyId === plan.id ? 'Please wait…' : 'Subscribe'}
                </button>
              </div>
            ))}
          </div>
        )
      ) : publishedPackages.length === 0 ? (
        <p className="text-center text-sm text-gray-500">No credit packages available right now.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {publishedPackages.map((pkg) => (
            <div key={pkg.id} className="flex flex-col justify-between rounded-lg border border-gray-200 bg-white p-5">
              <div className="space-y-2">
                <h2 className="text-lg font-bold text-brand-navy">{pkg.name}</h2>
                <p className="text-2xl font-bold">Rs {pkg.pricePkr}</p>
                <p className="text-sm text-gray-600">
                  {pkg.credits} credits{pkg.bonusCredits > 0 ? ` + ${pkg.bonusCredits} bonus` : ''}
                </p>
              </div>
              <button
                onClick={() => onBuyCredits(pkg.id)}
                disabled={busyId === pkg.id}
                className="mt-4 w-full rounded-md bg-brand-gold px-4 py-2 text-sm font-semibold text-brand-navy disabled:opacity-50"
              >
                {busyId === pkg.id ? 'Please wait…' : 'Buy Credits'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
