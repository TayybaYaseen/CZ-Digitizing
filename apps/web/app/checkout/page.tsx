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

  useEffect(() => {
    if (isReady && !user) router.replace('/login');
  }, [isReady, user, router]);

  async function onConfirm() {
    setError(null);
    setSubmitting(true);
    try {
      const order = await apiFetch<OrderDto>('/api/cart/checkout', {
        method: 'POST',
        body: JSON.stringify({ paymentMethod }),
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
