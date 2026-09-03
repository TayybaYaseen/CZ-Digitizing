'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { ApiError } from '@czd/shared-types';
import { ApiClientError, apiFetch } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';

// Mirrors apps/api/src/cart/dto/cart.dto.ts's CartItemDto/CartDto.
export interface CartItemDto {
  id: string;
  designId: string | null;
  bundleId: string | null;
  name: string;
  previewImageUrl: string | null;
  categoryName: string | null;
  subcategoryName: string | null;
  sizeId: string | null;
  sizeLabel: string | null;
  quantity: number;
  unitPricePkr: number;
  linePriceAtSelectionPkr: number;
  lineDiscountPkr: number;
  status: 'active' | 'saved_for_later';
  isPublished: boolean;
}

export interface CartDto {
  items: CartItemDto[];
  savedForLater: CartItemDto[];
  subtotalPkr: number;
  discountPkr: number;
  creditsUsed: number;
  totalPkr: number;
}

interface CartContextValue {
  cart: CartDto | null;
  itemCount: number;
  error: ApiError | null;
  refresh: () => Promise<void>;
  addItem: (input: { designId?: string; bundleId?: string; sizeId?: string; quantity?: number }) => Promise<void>;
  updateQuantity: (itemId: string, quantity: number) => Promise<void>;
  removeItem: (itemId: string) => Promise<void>;
  saveForLater: (itemId: string) => Promise<void>;
  moveToCart: (itemId: string) => Promise<void>;
}

const CartContext = createContext<CartContextValue | null>(null);

function toError(err: unknown): ApiError {
  return err instanceof ApiClientError ? err.error : { code: 'INTERNAL_ERROR', message: 'Something went wrong with your cart.', traceId: '' };
}

// docs/specs/2026-08-28-07-shopping-cart-checkout.md AC-1/AC-3 (aspect A-011) — the header badge
// and every "Add to Cart" button share this one cart state via useCart(). AC-5's guest→account
// merge is handled here, not in the login pages themselves: on the transition from signed-out to
// signed-in, this fires POST /api/cart/merge once (the guest-session cookie is still present at
// that point — the API reads it the same way it does for every other cart route) and refreshes.
export function CartProvider({ children }: { children: ReactNode }) {
  const { user, accessToken } = useAuth();
  const [cart, setCart] = useState<CartDto | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const wasSignedIn = useRef(false);
  const hasMergedForUser = useRef<string | null>(null);

  // Every /api/cart* route is guest-or-auth (@Public()) except merge/checkout/credits — sending
  // the bearer token whenever one exists (not just on the auth-required routes) is what makes a
  // signed-in customer's requests resolve to their own customer cart instead of a fresh guest one
  // (CartService.actorFrom() only picks the customer cart when req.user is populated).
  const authHeaders = useCallback((): Record<string, string> => (accessToken ? { Authorization: `Bearer ${accessToken}` } : {}), [accessToken]);

  const refresh = useCallback(async () => {
    try {
      const data = await apiFetch<CartDto>('/api/cart', { headers: authHeaders() });
      setCart(data);
      setError(null);
    } catch (err) {
      setError(toError(err));
    }
  }, [authHeaders]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const justSignedIn = !!user && !wasSignedIn.current;
    wasSignedIn.current = !!user;
    if (!justSignedIn || !user || hasMergedForUser.current === user.id) return;
    hasMergedForUser.current = user.id;
    apiFetch('/api/cart/merge', { method: 'POST', body: JSON.stringify({}), headers: authHeaders() })
      .then(() => refresh())
      .catch(() => refresh()); // merge failing (e.g. no guest cart existed) still means "reload the real cart"
  }, [user, refresh, authHeaders]);

  async function addItem(input: { designId?: string; bundleId?: string; sizeId?: string; quantity?: number }) {
    try {
      const data = await apiFetch<CartDto>('/api/cart/items', {
        method: 'POST',
        body: JSON.stringify({ quantity: 1, ...input }),
        headers: authHeaders(),
      });
      setCart(data);
      setError(null);
    } catch (err) {
      setError(toError(err));
      throw err;
    }
  }

  async function updateQuantity(itemId: string, quantity: number) {
    try {
      const data = await apiFetch<CartDto>(`/api/cart/items/${itemId}`, { method: 'PUT', body: JSON.stringify({ quantity }), headers: authHeaders() });
      setCart(data);
      setError(null);
    } catch (err) {
      setError(toError(err));
    }
  }

  async function removeItem(itemId: string) {
    try {
      await apiFetch(`/api/cart/items/${itemId}`, { method: 'DELETE', headers: authHeaders() });
      await refresh();
    } catch (err) {
      setError(toError(err));
    }
  }

  async function saveForLater(itemId: string) {
    try {
      const data = await apiFetch<CartDto>(`/api/cart/items/${itemId}/save-for-later`, { method: 'PUT', body: JSON.stringify({}), headers: authHeaders() });
      setCart(data);
      setError(null);
    } catch (err) {
      setError(toError(err));
    }
  }

  async function moveToCart(itemId: string) {
    try {
      const data = await apiFetch<CartDto>(`/api/cart/items/${itemId}/move-to-cart`, { method: 'PUT', body: JSON.stringify({}), headers: authHeaders() });
      setCart(data);
      setError(null);
    } catch (err) {
      setError(toError(err));
    }
  }

  const itemCount = cart?.items.reduce((sum, i) => sum + i.quantity, 0) ?? 0;

  return (
    <CartContext.Provider value={{ cart, itemCount, error, refresh, addItem, updateQuantity, removeItem, saveForLater, moveToCart }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart() must be used within <CartProvider>');
  return ctx;
}
