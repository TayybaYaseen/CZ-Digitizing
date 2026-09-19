'use client';

import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import type { ApiError } from '@czd/shared-types';
import { ApiClientError, apiFetch } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { ErrorBanner } from '@/components/ErrorBanner';

interface ProviderCharge {
  currency: string;
  amount: string;
  amountMinor: number;
  amountPkr: number;
  rateToPkr: number;
}

interface OrderDto {
  id: string;
  status: string;
  paymentStatus: string;
  paymentMethod: string;
  totalPkr: number;
  amountDuePkr: number;
  creditsUsed: number;
  providerCharge: ProviderCharge | null;
}

interface PaymentSession {
  provider: 'paypal' | 'stripe';
  approveUrl: string | null;
  clientSecret: string | null;
  publishableKey: string | null;
  currency: string;
  amount: string;
  amountMinor: number;
}

// Just enough of Stripe.js's surface for the Payment Element (loaded from js.stripe.com at runtime,
// as Stripe requires — never bundled).
interface StripePaymentElement {
  mount(target: HTMLElement): void;
  destroy(): void;
}
interface StripeElements {
  create(type: 'payment'): StripePaymentElement;
}
interface StripeJs {
  elements(options: { clientSecret: string }): StripeElements;
  confirmPayment(options: {
    elements: StripeElements;
    confirmParams: { return_url: string };
    redirect: 'if_required';
  }): Promise<{ error?: { message?: string }; paymentIntent?: { status: string } }>;
}
declare global {
  interface Window {
    Stripe?: (publishableKey: string) => StripeJs;
  }
}

function loadStripeJs(): Promise<void> {
  if (window.Stripe) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-stripe-js]');
    const script = existing ?? document.createElement('script');
    script.addEventListener('load', () => resolve());
    script.addEventListener('error', () => reject(new Error('Could not load Stripe.')));
    if (!existing) {
      script.src = 'https://js.stripe.com/v3/';
      script.async = true;
      script.dataset.stripeJs = 'true';
      document.head.appendChild(script);
    }
  });
}

const toApiError = (err: unknown, fallback: string): ApiError => (err instanceof ApiClientError ? err.error : { code: 'INTERNAL_ERROR', message: fallback, traceId: '' });

// docs/specs/2026-08-28-08-orders-payment-processing.md §3/§5 (aspect A-013, AC-1/AC-10) — where a
// customer actually pays with PayPal or a card. This page STARTS the provider flow; it never marks
// anything paid. Every path ends at POST /api/orders/:id/verify-payment, where the SERVER reads the
// payment's real state from PayPal/Stripe (capturing an approved PayPal order) and only then confirms.
function PayContent() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const search = useSearchParams();
  const { user, accessToken, isReady } = useAuth();

  const [order, setOrder] = useState<OrderDto | null>(null);
  const [session, setSession] = useState<PaymentSession | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [stripeReady, setStripeReady] = useState(false);
  const elementHost = useRef<HTMLDivElement | null>(null);
  const stripeRef = useRef<{ stripe: StripeJs; elements: StripeElements; element: StripePaymentElement } | null>(null);
  const started = useRef(false);

  const returnedFromPaypal = search.get('paypal') === 'return';
  const cancelledAtPaypal = search.get('paypal') === 'cancel';
  const headers = accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined;

  useEffect(() => {
    if (isReady && !user) router.replace('/login');
  }, [isReady, user, router]);

  const goToConfirmation = useCallback(() => router.replace(`/order-confirmation/${params.id}`), [router, params.id]);

  const verifyOnServer = useCallback(async (): Promise<OrderDto | null> => {
    setVerifying(true);
    try {
      return await apiFetch<OrderDto>(`/api/orders/${params.id}/verify-payment`, { method: 'POST', headers });
    } catch (err) {
      setError(toApiError(err, 'We could not verify your payment yet.'));
      return null;
    } finally {
      setVerifying(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id, accessToken]);

  const startSession = useCallback(async (clearError = true) => {
    if (clearError) setError(null);
    try {
      const s = await apiFetch<PaymentSession>(`/api/orders/${params.id}/payment-session`, { method: 'POST', headers });
      setSession(s);
    } catch (err) {
      const apiError = toApiError(err, 'Could not start the payment.');
      if (apiError.code === 'ORDER_ALREADY_CONFIRMED') return goToConfirmation();
      setError(apiError);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id, accessToken, goToConfirmation]);

  // Load the order, then either finish a PayPal return or open a payment session.
  useEffect(() => {
    if (!user || !accessToken || started.current) return;
    started.current = true;
    (async () => {
      try {
        const loaded = await apiFetch<OrderDto>(`/api/orders/${params.id}`, { headers: { Authorization: `Bearer ${accessToken}` } });
        setOrder(loaded);
        if (loaded.paymentMethod === 'bank_transfer') return router.replace(`/checkout/bank-transfer/${loaded.id}`);
        if (loaded.paymentStatus === 'completed') return goToConfirmation();
        if (loaded.status !== 'payment_pending') {
          setError({ code: 'ORDER_NOT_PAYABLE', message: `This order is "${loaded.status}" and can no longer be paid.`, traceId: '' });
          return;
        }
        if (returnedFromPaypal) {
          const verified = await verifyOnServer();
          // Paid, or still settling at PayPal — either way the confirmation page shows the truth
          // and keeps checking; the client never decides.
          if (verified) return goToConfirmation();
          await startSession(false); // e.g. not actually approved: keep the reason on screen and let them try again
          return;
        }
        await startSession();
      } catch (err) {
        setError(toApiError(err, 'Could not load this order.'));
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, accessToken]);

  // Stripe: mount the Payment Element (cards + Stripe's own 3-D Secure) once we have a client secret.
  useEffect(() => {
    if (session?.provider !== 'stripe' || !session.clientSecret || !session.publishableKey || !elementHost.current) return;
    let cancelled = false;
    loadStripeJs()
      .then(() => {
        if (cancelled || !window.Stripe || !elementHost.current) return;
        const stripe = window.Stripe(session.publishableKey!);
        const elements = stripe.elements({ clientSecret: session.clientSecret! });
        const element = elements.create('payment');
        element.mount(elementHost.current);
        stripeRef.current = { stripe, elements, element };
        setStripeReady(true);
      })
      .catch((err: Error) => setError({ code: 'INTERNAL_ERROR', message: err.message, traceId: '' }));
    return () => {
      cancelled = true;
      stripeRef.current?.element.destroy();
      stripeRef.current = null;
      setStripeReady(false);
    };
  }, [session]);

  async function payWithCard() {
    const ctx = stripeRef.current;
    if (!ctx) return;
    setBusy(true);
    setError(null);
    const { error: stripeError, paymentIntent } = await ctx.stripe.confirmPayment({
      elements: ctx.elements,
      confirmParams: { return_url: `${window.location.origin}/order-confirmation/${params.id}` },
      redirect: 'if_required',
    });
    if (stripeError) {
      // Stripe's own message (declined card, failed 3-D Secure, ...) — shown as-is; the customer can try again.
      setError({ code: 'INTERNAL_ERROR', message: stripeError.message ?? 'Your card could not be charged.', traceId: '' });
      setBusy(false);
      return;
    }
    // Charged (or processing). The server, not this page, decides whether the order is now paid.
    if (paymentIntent) await verifyOnServer();
    setBusy(false);
    goToConfirmation();
  }

  function continueToPaypal() {
    if (!session?.approveUrl) return;
    setBusy(true);
    window.location.assign(session.approveUrl);
  }

  if (!isReady || !user) return null;

  const charge = session ?? (order?.providerCharge ? { currency: order.providerCharge.currency, amount: order.providerCharge.amount } : null);

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <h1 className="text-2xl font-bold">{order?.paymentMethod === 'paypal' ? 'Pay with PayPal' : 'Pay by card'}</h1>

      {order && (
        <div className="space-y-1 rounded-lg border border-gray-200 bg-white p-4 text-sm">
          <p>
            Order <strong>#{order.id}</strong> — Rs {order.totalPkr}
            {order.creditsUsed > 0 ? ` (Rs ${order.creditsUsed} paid with credits)` : ''}
          </p>
          {charge && order.providerCharge && (
            <p className="text-gray-600">
              You will be charged <strong>{charge.currency} {charge.amount}</strong> for the Rs {order.providerCharge.amountPkr} due, at 1 {charge.currency} = Rs {order.providerCharge.rateToPkr}.
            </p>
          )}
        </div>
      )}

      {cancelledAtPaypal && !error && <p className="rounded bg-amber-50 px-3 py-2 text-sm text-amber-800">You cancelled the PayPal payment. Your order is still waiting — you can try again below.</p>}
      <ErrorBanner error={error} />
      {(verifying || (returnedFromPaypal && !session && !error)) && <p className="text-sm text-gray-500">Confirming your payment with {order?.paymentMethod === 'paypal' ? 'PayPal' : 'the card processor'}…</p>}

      {session?.provider === 'paypal' && (
        <div className="space-y-3 rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-sm text-gray-600">You will be taken to PayPal to approve the payment, then brought back here.</p>
          <button onClick={continueToPaypal} disabled={busy || !session.approveUrl} className="w-full rounded-md bg-brand-gold px-4 py-2 text-sm font-semibold text-brand-navy disabled:opacity-50">
            {busy ? 'Redirecting to PayPal…' : `Continue to PayPal (${session.currency} ${session.amount})`}
          </button>
        </div>
      )}

      {session?.provider === 'stripe' && (
        <div className="space-y-3 rounded-lg border border-gray-200 bg-white p-4">
          <div ref={elementHost} data-testid="stripe-payment-element" className="min-h-[120px]" />
          {!stripeReady && !error && <p className="text-xs text-gray-400">Loading secure card form…</p>}
          <button onClick={payWithCard} disabled={busy || !stripeReady} className="w-full rounded-md bg-brand-gold px-4 py-2 text-sm font-semibold text-brand-navy disabled:opacity-50">
            {busy ? 'Processing…' : `Pay ${session.currency} ${session.amount}`}
          </button>
          <p className="text-xs text-gray-500">Your bank may ask you to confirm the payment (3-D Secure).</p>
        </div>
      )}

      {error && order?.status === 'payment_pending' && !session && (
        <button onClick={() => startSession()} className="rounded-md border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50">
          Try again
        </button>
      )}

      <p className="text-center text-sm">
        <Link href="/account/orders" className="text-brand-navy underline">
          View order history
        </Link>
      </p>
    </div>
  );
}

export default function PayPage() {
  return (
    <Suspense fallback={null}>
      <PayContent />
    </Suspense>
  );
}
