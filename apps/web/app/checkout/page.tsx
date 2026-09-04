'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { ApiError } from '@czd/shared-types';
import { ApiClientError, apiFetch } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { useCart } from '@/lib/cart-context';
import { ErrorBanner } from '@/components/ErrorBanner';

const PAYMENT_METHODS: { value: 'paypal' | 'stripe' | 'bank_transfer'; label: string }[] = [
  { value: 'paypal', label: 'PayPal' },
  { value: 'stripe', label: 'Credit/Debit Card (Stripe)' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
];

interface OrderDto {
  id: string;
  status: string;
  paymentMethod: string;
  bankTransferReference: string | null;
}

// docs/specs/2026-08-28-08-orders-payment-processing.md §3/§5 (aspect A-013) — checkout now
// actually creates an order via POST /api/cart/checkout (CartService.checkout() ->
// OrdersService.createFromCart()), instead of the ORDERS_NOT_AVAILABLE 501 stub this page used to
// show. Loading state: submit button disabled + spinner while the order is created (spec §5).
export default function CheckoutPage() {
  const router = useRouter();
  const { user, accessToken, isReady } = useAuth();
  const { cart, refresh } = useCart();
  const [paymentMethod, setPaymentMethod] = useState<(typeof PAYMENT_METHODS)[number]['value']>('paypal');
  const [error, setError] = useState<ApiError | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // docs/specs/2026-08-28-09-subscriptions-credits.md AC-7 — apply the customer's own credit
  // balance against this order. creditsInput is the raw field value (validated live against
  // POST /api/cart/credits as the customer types); creditsToApplyPkr is what's actually sent on
  // checkout below. Kept as two pieces of state so a mid-typing invalid value never gets submitted.
  const [creditsInput, setCreditsInput] = useState('');
  const [creditsToApplyPkr, setCreditsToApplyPkr] = useState(0);
  const [creditsError, setCreditsError] = useState<ApiError | null>(null);
  const [checkingCredits, setCheckingCredits] = useState(false);

  useEffect(() => {
    if (isReady && !user) router.replace('/login');
  }, [isReady, user, router]);

  useEffect(() => {
    if (!accessToken) return;
    const amount = Number(creditsInput);
    if (!creditsInput.trim() || !Number.isFinite(amount) || amount <= 0) {
      setCreditsToApplyPkr(0);
      setCreditsError(null);
      return;
    }
    setCheckingCredits(true);
    const timer = setTimeout(() => {
      apiFetch<{ creditsUsed: number }>('/api/cart/credits', {
        method: 'POST',
        body: JSON.stringify({ amountPkr: amount }),
        headers: { Authorization: `Bearer ${accessToken}` },
      })
        .then((res) => {
          setCreditsToApplyPkr(res.creditsUsed);
          setCreditsError(null);
        })
        .catch((err) => {
          setCreditsToApplyPkr(0);
          setCreditsError(err instanceof ApiClientError ? err.error : { code: 'INTERNAL_ERROR', message: 'Could not validate credits.', traceId: '' });
        })
        .finally(() => setCheckingCredits(false));
    }, 250);
    return () => clearTimeout(timer);
  }, [creditsInput, accessToken]);

  async function onConfirm() {
    setError(null);
    setSubmitting(true);
    try {
      const order = await apiFetch<OrderDto>('/api/cart/checkout', {
        method: 'POST',
        body: JSON.stringify({ paymentMethod, creditsToApplyPkr }),
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      await refresh();
      if (paymentMethod === 'bank_transfer') {
        router.push(`/checkout/bank-transfer/${order.id}`);
      } else {
        router.push(`/order-confirmation/${order.id}`);
      }
    } catch (err) {
      setError(err instanceof ApiClientError ? err.error : { code: 'INTERNAL_ERROR', message: 'Checkout failed.', traceId: '' });
    } finally {
      setSubmitting(false);
    }
  }

  if (!isReady || !user) return null;

  if (!cart || cart.items.length === 0) {
    return (
      <div className="mx-auto max-w-2xl space-y-4 text-center">
        <p className="text-sm text-gray-500">Your cart is empty.</p>
        <Link href="/designs" className="inline-block rounded-md bg-brand-gold px-4 py-2 text-sm font-semibold text-brand-navy">
          Continue Shopping
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">Checkout</h1>

      <div className="space-y-2 rounded-lg border border-gray-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-brand-navy">Order Summary</h2>
        {cart.items.map((item) => (
          <div key={item.id} className="flex justify-between text-sm">
            <span>
              {item.name} {item.sizeLabel ? `(${item.sizeLabel})` : ''} × {item.quantity}
            </span>
            <span>Rs {item.unitPricePkr * item.quantity}</span>
          </div>
        ))}
        <div className="flex justify-between border-t border-gray-100 pt-2 text-base font-semibold text-brand-navy">
          <span>Total</span>
          <span>Rs {cart.totalPkr}</span>
        </div>
      </div>

      <div className="space-y-2 rounded-lg border border-gray-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-brand-navy">Payment Method</h2>
        {PAYMENT_METHODS.map((method) => (
          <label key={method.value} className="flex items-center gap-2 text-sm">
            <input type="radio" name="paymentMethod" checked={paymentMethod === method.value} onChange={() => setPaymentMethod(method.value)} />
            {method.label}
          </label>
        ))}
      </div>

      <div className="space-y-2 rounded-lg border border-gray-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-brand-navy">Apply Credits</h2>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={0}
            value={creditsInput}
            onChange={(e) => setCreditsInput(e.target.value)}
            placeholder="0"
            className="w-32 rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
          <span className="text-sm text-gray-500">PKR of your credit balance</span>
          {checkingCredits && <span className="text-xs text-gray-400">Checking…</span>}
        </div>
        {creditsToApplyPkr > 0 && !creditsError && (
          <p className="text-sm text-emerald-700">Rs {creditsToApplyPkr} in credits will be applied to this order.</p>
        )}
        <ErrorBanner error={creditsError} />
      </div>

      <ErrorBanner error={error} />

      <button
        onClick={onConfirm}
        disabled={submitting}
        className="flex w-full items-center justify-center gap-2 rounded-md bg-brand-gold px-4 py-2 text-sm font-semibold text-brand-navy disabled:opacity-50"
      >
        {submitting && <span className="h-4 w-4 animate-spin rounded-full border-2 border-brand-navy border-t-transparent" aria-hidden />}
        {submitting ? 'Placing order…' : 'Confirm Order'}
      </button>
    </div>
  );
}
