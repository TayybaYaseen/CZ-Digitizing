import { createHash, randomBytes } from 'crypto';
import type { Request, Response } from 'express';

// Guest checkout — the browser-held secret that ties a visitor's browser to the orders it placed
// without signing in. 32 random bytes (256 bits) from the CSPRNG, base64url: unguessable, and the
// ONLY thing that authorizes /api/guest-orders — never the order id, email, name or WhatsApp number.
//
// Only SHA-256(key) is stored (orders.guest_access_key_hash). A plain hash (not bcrypt) is right
// here: the key is full-entropy random, so there is nothing to brute-force, and the lookup has to be
// an indexed equality match.
export const GUEST_ORDERS_COOKIE = 'czd_guest_orders';
// Same ~13-month lifetime as the cart-session and device-id cookies (the browser maximum).
export const GUEST_ORDERS_COOKIE_MAX_AGE_MS = 400 * 24 * 60 * 60 * 1000;

const GUEST_ACCESS_KEY_PATTERN = /^[A-Za-z0-9_-]{43}$/; // exactly 32 bytes, base64url, no padding

export function generateGuestAccessKey(): string {
  return randomBytes(32).toString('base64url');
}

export function hashGuestAccessKey(key: string): string {
  return createHash('sha256').update(key, 'utf8').digest('hex');
}

// Anything that isn't exactly the shape we mint is treated as "no key" — a tampered or truncated
// cookie simply matches no orders rather than reaching the database as an arbitrary string.
export function readGuestAccessKey(req: Request): string | null {
  const value: unknown = req.cookies?.[GUEST_ORDERS_COOKIE];
  return typeof value === 'string' && GUEST_ACCESS_KEY_PATTERN.test(value) ? value : null;
}

export function readGuestAccessKeyHash(req: Request): string | null {
  const key = readGuestAccessKey(req);
  return key ? hashGuestAccessKey(key) : null;
}

// httpOnly (page scripts can never read it), SameSite=Lax and Secure in production — the same
// attributes as the czd_cart_session / czd_device_id cookies, so it travels exactly where they do.
export function setGuestAccessCookie(res: Response, key: string): void {
  res.cookie(GUEST_ORDERS_COOKIE, key, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: GUEST_ORDERS_COOKIE_MAX_AGE_MS,
  });
}
