'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { ApiError } from '@czd/shared-types';
import { ApiClientError, apiFetch } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { type CartItemDto, useCart } from '@/lib/cart-context';
import { ErrorBanner } from '@/components/ErrorBanner';

function CartLine({ item, savedForLater }: { item: CartItemDto; savedForLater: boolean }) {
  const { updateQuantity, removeItem, saveForLater, moveToCart } = useCart();

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
            <p className="text-sm font-semibold text-brand-navy">{item.name}</p>
            {(item.categoryName || item.subcategoryName) && (
              <p className="text-xs text-gray-500">{[item.categoryName, item.subcategoryName].filter(Boolean).join(' / ')}</p>
            )}
            {item.sizeLabel && <p className="text-xs text-gray-500">Size: {item.sizeLabel}</p>}
            {!item.isPublished && <p className="text-xs font-medium text-red-600">No longer available</p>}
          </div>
          <button onClick={() => removeItem(item.id)} className="text-xs text-gray-400 hover:text-red-600">
            Remove
          </button>
        </div>

        <div className="mt-auto flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm">
            {!savedForLater && (
              <>
                <label className="text-xs text-gray-500">Qty</label>
                <input
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
            <span className="font-semibold text-brand-navy">Rs {item.unitPricePkr}</span>
            {item.lineDiscountPkr > 0 && <span className="text-xs text-gray-400 line-through">Rs {item.unitPricePkr + item.lineDiscountPkr / item.quantity}</span>}
          </div>

          {savedForLater ? (
            <button onClick={() => moveToCart(item.id)} className="text-xs font-medium text-brand-navy underline">
              Move to cart
            </button>
          ) : (
            <button onClick={() => saveForLater(item.id)} className="text-xs font-medium text-brand-navy underline">
              Save for later
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
      setCreditsError(err instanceof ApiClientError ? err.error : { code: 'INTERNAL_ERROR', message: 'Failed to apply credits.', traceId: '' });
    }
  }

  function onCheckout() {
    if (!user) {
      router.push('/login');
      return;
    }
    router.push('/checkout');
  }

  if (cart === null && !error) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <h1 className="text-2xl font-bold">My Cart</h1>
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
      <h1 className="text-2xl font-bold">My Cart</h1>

      <ErrorBanner error={error} />

      {cart.items.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white px-4 py-10 text-center">
          <p className="text-sm text-gray-500">Your cart is empty.</p>
          <Link href="/designs" className="mt-3 inline-block rounded-md bg-brand-gold px-4 py-2 text-sm font-semibold text-brand-navy">
            Continue Shopping
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
              <span className="text-gray-500">Subtotal</span>
              <span>Rs {cart.subtotalPkr}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Discount</span>
              <span>-Rs {cart.discountPkr}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Credits used</span>
              <span>-Rs {cart.creditsUsed}</span>
            </div>
            <div className="flex justify-between border-t border-gray-100 pt-2 text-base font-semibold text-brand-navy">
              <span>Total</span>
              <span>Rs {cart.totalPkr}</span>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <input
                type="number"
                min={0}
                placeholder="Credits to apply (PKR)"
                value={creditsInput}
                onChange={(e) => setCreditsInput(e.target.value)}
                className="flex-1 rounded-md border border-gray-300 px-2 py-1 text-sm"
              />
              <button onClick={onApplyCredits} className="rounded-md border border-gray-300 px-3 py-1 text-sm">
                Apply
              </button>
            </div>
            {creditsError && <p className="text-xs text-red-600">{creditsError.message}</p>}

            <button
              onClick={onCheckout}
              disabled={!allValid}
              className="mt-3 w-full rounded-md bg-brand-gold px-4 py-2 text-sm font-semibold text-brand-navy disabled:cursor-not-allowed disabled:opacity-50"
            >
              Proceed to Checkout
            </button>
          </div>
        </div>
      )}

      {cart.savedForLater.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Saved for Later</h2>
          {cart.savedForLater.map((item) => (
            <CartLine key={item.id} item={item} savedForLater />
          ))}
        </div>
      )}
    </div>
  );
}
