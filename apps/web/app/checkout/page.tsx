'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import type { ApiError } from '@czd/shared-types';
import { ApiClientError, apiFetch } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { useCart, type CartDto } from '@/lib/cart-context';
import { formatPkr } from '@/lib/format';
import { useLocale } from '@/lib/locale-context';
import { ErrorBanner } from '@/components/ErrorBanner';
import { FormField, inputClass } from '@/components/FormField';
import { clientError } from '@/i18n/api-errors';

interface OrderDto {
  id: string;
  status: string;
  paymentStatus: string;
  paymentMethod: string;
  amountDuePkr: number;
  bankTransferReference: string | null;
}

// docs/specs/2026-08-28-08-orders-payment-processing.md §3/§5/§11 (aspect A-013) — checkout creates
// an order via POST /api/cart/checkout (CartService.checkout() -> OrdersService.createFromCart()).
// BANK TRANSFER is the only payment method, so there is nothing to choose: the customer is sent to
// /checkout/bank-transfer/:id to see the exact PKR amount and the bank details Admin configured, then
// uploads a receipt. Loading state: submit button disabled + spinner while the order is created.
// Signing in is optional: a visitor who isn't signed in gets the guest checkout (GuestCheckout below).
export default function CheckoutPage() {
  const router = useRouter();
  const { user, accessToken, isReady } = useAuth();
  const { cart, refresh } = useCart();
  const { t } = useLocale();
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
          setCreditsError(err instanceof ApiClientError ? err.error : clientError('errors.validateCreditsFailed'));
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
        body: JSON.stringify({ paymentMethod: 'bank_transfer', creditsToApplyPkr }),
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      await refresh();
      if (order.paymentStatus === 'completed') {
        // Fully covered by credits — nothing left to transfer or pay.
        router.push(`/order-confirmation/${order.id}`);
      } else {
        router.push(`/checkout/bank-transfer/${order.id}`);
      }
    } catch (err) {
      setError(err instanceof ApiClientError ? err.error : clientError('errors.checkoutFailed'));
    } finally {
      setSubmitting(false);
    }
  }

  if (!isReady) return null;
  // Guest checkout — a visitor who isn't signed in buys with just their contact details.
  if (!user) return <GuestCheckout />;

  const fullyCoveredByCredits = Boolean(cart && cart.totalPkr > 0 && creditsToApplyPkr >= cart.totalPkr && !creditsError);

  if (!cart || cart.items.length === 0) return <EmptyCheckout />;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">{t('checkout.title')}</h1>

      <div className="space-y-2 rounded-lg border border-gray-200 bg-white p-4">
        <CartSummaryLines cart={cart} />
        {creditsToApplyPkr > 0 && !creditsError && (
          <>
            <div className="flex justify-between text-sm text-emerald-700">
              <span>{t('checkout.creditsApplied')}</span>
              <span>− {formatPkr(creditsToApplyPkr)}</span>
            </div>
            <div className="flex justify-between text-base font-semibold text-brand-navy">
              <span>{t('checkout.amountToTransfer')}</span>
              <span>{formatPkr(Math.max(0, cart.totalPkr - creditsToApplyPkr))}</span>
            </div>
          </>
        )}
      </div>

      <div className="space-y-2 rounded-lg border border-gray-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-brand-navy">{t('checkout.paymentMethod')}</h2>
        <p className="text-sm font-medium" data-testid="payment-method">{t('checkout.bankTransfer')}</p>
        <p className="text-sm text-gray-600">{fullyCoveredByCredits ? t('checkout.coveredByCredits') : t('checkout.bankTransferInfo')}</p>
      </div>

      <div className="space-y-2 rounded-lg border border-gray-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-brand-navy">{t('checkout.applyCredits')}</h2>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={0}
            value={creditsInput}
            onChange={(e) => setCreditsInput(e.target.value)}
            placeholder="0"
            aria-label={t('checkout.creditsBalanceSuffix')}
            className="w-32 rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
          <span className="text-sm text-gray-500">{t('checkout.creditsBalanceSuffix')}</span>
          {checkingCredits && <span className="text-xs text-gray-400">{t('common.checking')}</span>}
        </div>
        {creditsToApplyPkr > 0 && !creditsError && (
          <p className="text-sm text-emerald-700">
            {Number(creditsInput) > creditsToApplyPkr
              ? t('checkout.creditsWillApplyCapped', { amount: formatPkr(creditsToApplyPkr) })
              : t('checkout.creditsWillApply', { amount: formatPkr(creditsToApplyPkr) })}
          </p>
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
        {submitting ? t('common.loading') : t('checkout.placeOrder')}
      </button>
    </div>
  );
}

function EmptyCheckout() {
  const { t } = useLocale();
  return (
    <div className="mx-auto max-w-2xl space-y-4 text-center">
      <p className="text-sm text-gray-500">{t('cart.empty')}</p>
      <Link href="/designs" className="inline-block rounded-md bg-brand-gold px-4 py-2 text-sm font-semibold text-brand-navy">
        {t('cart.continueShopping')}
      </Link>
    </div>
  );
}

function CartSummaryLines({ cart }: { cart: CartDto }) {
  const { t } = useLocale();
  return (
    <>
      <h2 className="text-sm font-semibold text-brand-navy">{t('checkout.orderSummary')}</h2>
      {cart.items.map((item) => (
        <div key={item.id} className="flex justify-between gap-3 text-sm">
          <span>
            {item.name} {item.sizeLabel ? `(${item.sizeLabel})` : ''} × {item.quantity}
          </span>
          <span className="shrink-0">{formatPkr(item.unitPricePkr * item.quantity)}</span>
        </div>
      ))}
      <div className="flex justify-between border-t border-gray-100 pt-2 text-base font-semibold text-brand-navy">
        <span>{t('cart.total')}</span>
        <span>{formatPkr(cart.totalPkr)}</span>
      </div>
    </>
  );
}

// Mirrors apps/api/src/cart/dto/cart-write.dto.ts GuestCheckoutDto. Messages are translation keys,
// resolved by FormField (i18n A-021) — the API returns the same keys/patterns for its own checks.
const guestSchema = z.object({
  name: z.string().trim().min(1, 'validation.required').max(120),
  email: z.string().trim().email('validation.email').max(254),
  whatsapp: z
    .string()
    .trim()
    .max(32)
    .regex(/^(\+?[0-9][0-9 ().-]{5,30})?$/, 'validation.whatsapp')
    .optional(),
});

type GuestFormValues = z.infer<typeof guestSchema>;

// Guest checkout — no account, no sign-in. POST /api/cart/guest-checkout turns this browser's cart
// into an ordinary bank-transfer order and (only once the order exists) sets the httpOnly cookie that
// lets this browser see it again — on the bank-transfer page next, and on the home page afterwards.
// Nothing here can mark the order paid: payment is confirmed only by Admin approving the receipt.
function GuestCheckout() {
  const router = useRouter();
  const { cart, refresh } = useCart();
  const { t, rich } = useLocale();
  const [apiError, setApiError] = useState<ApiError | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<GuestFormValues>({ resolver: zodResolver(guestSchema) });

  async function onSubmit(values: GuestFormValues) {
    setApiError(null);
    try {
      const order = await apiFetch<OrderDto>('/api/cart/guest-checkout', {
        method: 'POST',
        body: JSON.stringify({ paymentMethod: 'bank_transfer', name: values.name, email: values.email, whatsapp: values.whatsapp || undefined }),
      });
      await refresh();
      router.push(`/checkout/bank-transfer/${order.id}`);
    } catch (err) {
      if (err instanceof ApiClientError && err.error.code === 'VALIDATION_ERROR' && err.error.errors) {
        for (const fieldError of err.error.errors) setError(fieldError.field as keyof GuestFormValues, { message: fieldError.message });
      } else {
        setApiError(err instanceof ApiClientError ? err.error : clientError('errors.checkoutFailed'));
      }
    }
  }

  if (!cart) return null;
  if (cart.items.length === 0) return <EmptyCheckout />;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">{t('checkout.title')}</h1>

      <div className="space-y-2 rounded-lg border border-gray-200 bg-white p-4">
        <CartSummaryLines cart={cart} />
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 rounded-lg border border-gray-200 bg-white p-4" noValidate data-testid="guest-checkout-form">
        <div className="space-y-1">
          <h2 className="text-sm font-semibold text-brand-navy">{t('checkout.guestDetails')}</h2>
          <p className="text-sm text-gray-600">{t('checkout.guestIntro')}</p>
        </div>
        <FormField label={t('checkout.guestName')} htmlFor="guest-name" error={errors.name}>
          <input id="guest-name" type="text" autoComplete="name" className={inputClass} {...register('name')} />
        </FormField>
        <FormField label={t('checkout.guestEmail')} htmlFor="guest-email" error={errors.email}>
          <input id="guest-email" type="email" autoComplete="email" dir="ltr" className={inputClass} {...register('email')} />
        </FormField>
        <FormField label={t('checkout.guestWhatsapp')} htmlFor="guest-whatsapp" error={errors.whatsapp}>
          <input id="guest-whatsapp" type="tel" autoComplete="tel" dir="ltr" className={inputClass} {...register('whatsapp')} />
        </FormField>
        <p className="text-sm text-gray-600">
          {rich('checkout.guestSignInPrompt', {
            link: (chunk) => (
              <Link href="/login?next=%2Fcheckout" className="font-medium text-brand-navy underline hover:text-brand-gold">
                {chunk}
              </Link>
            ),
          })}
        </p>
      </form>

      <div className="space-y-2 rounded-lg border border-gray-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-brand-navy">{t('checkout.paymentMethod')}</h2>
        <p className="text-sm font-medium" data-testid="payment-method">{t('checkout.bankTransfer')}</p>
        <p className="text-sm text-gray-600">{t('checkout.bankTransferInfo')}</p>
      </div>

      <ErrorBanner error={apiError} />

      <button
        type="button"
        onClick={handleSubmit(onSubmit)}
        disabled={isSubmitting}
        className="flex w-full items-center justify-center gap-2 rounded-md bg-brand-gold px-4 py-2 text-sm font-semibold text-brand-navy disabled:opacity-50"
      >
        {isSubmitting && <span className="h-4 w-4 animate-spin rounded-full border-2 border-brand-navy border-t-transparent" aria-hidden />}
        {isSubmitting ? t('common.loading') : t('checkout.placeOrder')}
      </button>
    </div>
  );
}
