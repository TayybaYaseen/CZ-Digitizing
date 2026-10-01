'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { ApiError } from '@czd/shared-types';
import { ApiClientError, apiFetch } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { type CartItemDto, useCart } from '@/lib/cart-context';
import { useLocale } from '@/lib/locale-context';
import { formatNumber } from '@/lib/format';
import { ErrorBanner } from '@/components/ErrorBanner';
import { clientError } from '@/i18n/api-errors';

function CartLine({ item, savedForLater }: { item: CartItemDto; savedForLater: boolean }) {
  const { updateQuantity, removeItem, saveForLater, moveToCart } = useCart();
  const { locale, t } = useLocale();

  return (
    <div className="flex gap-4 rounded-lg border border-gray-200 bg-white p-4">
      {item.previewImageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- arbitrary admin-supplied URL
        <img src={item.previewImageUrl} alt={item.name} className="h-20 w-20 flex-shrink-0 rounded-md object-cover" />
      ) : (
        <div className="h-20 w-20 flex-shrink-0 rounded-md bg-brand-lightGray" />
      )}

      <div className="flex flex-1 flex-col gap-1">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p dir="auto" className="text-sm font-semibold text-brand-navy">{item.name}</p>
            {(item.categoryName || item.subcategoryName) && (
              <p className="text-xs text-gray-500">{[item.categoryName, item.subcategoryName].filter(Boolean).join(' / ')}</p>
            )}
            {item.sizeLabel && <p className="text-xs text-gray-500">{t('cart.sizeLabel', { size: item.sizeLabel })}</p>}
            {!item.isPublished && <p className="text-xs font-medium text-red-600">{t('cart.unavailable')}</p>}
          </div>
          <button onClick={() => removeItem(item.id)} className="text-xs text-gray-400 hover:text-red-600">
            {t('common.remove')}
          </button>
        </div>

        <div className="mt-auto flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm">
            {!savedForLater && (
              <>
                <label htmlFor={`qty-${item.id}`} className="text-xs text-gray-500">{t('cart.qty')}</label>
                <input
                  id={`qty-${item.id}`}
                  type="number"
                  min={1}
                  value={item.quantity}
                  onChange={(e) => {
                    const q = Number(e.target.value);
                    if (q >= 1) updateQuantity(item.id, q);
                  }}
                  className="w-16 rounded-md border border-gray-300 px-2 py-1 text-sm"
                />
              </>
            )}
            <span className="font-semibold text-brand-navy">Rs {formatNumber(item.unitPricePkr, locale)}</span>
            {item.lineDiscountPkr > 0 && <span className="text-xs text-gray-400 line-through">Rs {formatNumber(item.unitPricePkr + item.lineDiscountPkr / item.quantity, locale)}</span>}
          </div>

          {savedForLater ? (
            <button onClick={() => moveToCart(item.id)} className="text-xs font-medium text-brand-navy underline">
              {t('cart.moveToCart')}
            </button>
          ) : (
            <button onClick={() => saveForLater(item.id)} className="text-xs font-medium text-brand-navy underline">
              {t('cart.saveForLater')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// docs/specs/2026-08-28-07-shopping-cart-checkout.md §5 — Loading/Empty/Error/Success states.
export default function CartPage() {
  const router = useRouter();
  const { user, accessToken } = useAuth();
  const { cart, error } = useCart();
  const { t, locale, errorMessage } = useLocale();
  const [creditsInput, setCreditsInput] = useState('');
  const [creditsError, setCreditsError] = useState<ApiError | null>(null);

  async function onApplyCredits() {
    setCreditsError(null);
    if (!user) {
      router.push('/login');
      return;
    }
    try {
      await apiFetch('/api/cart/credits', {
        method: 'POST',
        body: JSON.stringify({ amountPkr: Number(creditsInput) || 0 }),
        headers: { Authorization: `Bearer ${accessToken}` },
      });
    } catch (err) {
      setCreditsError(err instanceof ApiClientError ? err.error : clientError('errors.applyCreditsFailed'));
    }
  }

  // Guest checkout — no sign-in needed to buy: /checkout itself offers the guest details form to a
  // visitor who isn't signed in (and a link to sign in instead). Credits above still need an account.
  function onCheckout() {
    router.push('/checkout');
  }

  if (cart === null && !error) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <h1 className="text-2xl font-bold">{t('cart.title')}</h1>
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-lg bg-gray-100" />
        ))}
      </div>
    );
  }

  if (!cart) return <ErrorBanner error={error} />;

  const allValid = cart.items.every((i) => i.isPublished && (!i.designId || i.sizeId));

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-2xl font-bold">{t('cart.title')}</h1>

      <ErrorBanner error={error} />

      {cart.items.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white px-4 py-10 text-center">
          <p className="text-sm text-gray-500">{t('cart.empty')}</p>
          <Link href="/designs" className="mt-3 inline-block rounded-md bg-brand-gold px-4 py-2 text-sm font-semibold text-brand-navy">
            {t('cart.continueShopping')}
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="space-y-3">
            {cart.items.map((item) => (
              <CartLine key={item.id} item={item} savedForLater={false} />
            ))}
          </div>

          <div className="space-y-2 rounded-lg border border-gray-200 bg-white p-4">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">{t('cart.subtotal')}</span>
              <span>Rs {formatNumber(cart.subtotalPkr, locale)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">{t('cart.discount')}</span>
              <span>-Rs {formatNumber(cart.discountPkr, locale)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">{t('cart.creditsUsed')}</span>
              <span>-Rs {formatNumber(cart.creditsUsed, locale)}</span>
            </div>
            <div className="flex justify-between border-t border-gray-100 pt-2 text-base font-semibold text-brand-navy">
              <span>{t('cart.total')}</span>
              <span>Rs {formatNumber(cart.totalPkr, locale)}</span>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <input
                type="number"
                min={0}
                placeholder={t('cart.creditsPlaceholder')}
                aria-label={t('cart.creditsPlaceholder')}
                value={creditsInput}
                onChange={(e) => setCreditsInput(e.target.value)}
                className="flex-1 rounded-md border border-gray-300 px-2 py-1 text-sm"
              />
              <button onClick={onApplyCredits} className="rounded-md border border-gray-300 px-3 py-1 text-sm">
                {t('common.apply')}
              </button>
            </div>
            {creditsError && <p className="text-xs text-red-600">{errorMessage(creditsError)}</p>}

            <button
              onClick={onCheckout}
              disabled={!allValid}
              className="mt-3 w-full rounded-md bg-brand-gold px-4 py-2 text-sm font-semibold text-brand-navy disabled:cursor-not-allowed disabled:opacity-50"
            >
              {t('cart.checkout')}
            </button>
          </div>
        </div>
      )}

      {cart.savedForLater.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">{t('cart.savedForLater')}</h2>
          {cart.savedForLater.map((item) => (
            <CartLine key={item.id} item={item} savedForLater />
          ))}
        </div>
      )}
    </div>
  );
}
