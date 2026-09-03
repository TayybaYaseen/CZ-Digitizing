import { Injectable, NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { NextFunction, Request, Response } from 'express';

export const CART_SESSION_COOKIE = 'czd_cart_session';
export const CART_SESSION_COOKIE_MAX_AGE_MS = 400 * 24 * 60 * 60 * 1000; // ~13 months, matches DEVICE_ID_COOKIE

export interface RequestWithCartSession extends Request {
  guestCartSessionId: string;
}

// docs/specs/2026-08-28-07-shopping-cart-checkout.md §4/§8 (aspect A-011) — mints a guest-cart
// identity cookie on first contact with any api/cart* route, mirroring
// apps/api/src/auth/auth.controller.ts's resolveDevice()/DEVICE_ID_COOKIE pattern exactly. Runs
// unconditionally (before the @Public()/JwtAuthGuard optional-auth layer), because unlike
// Bundles/Favorites' "req.user present or absent" pattern, cart needs a real identity even when
// there is no user at all — a logged-in customer's requests still get this cookie (harmless; the
// service resolves by customerId first and only falls back to guestSessionId when there's no
// user), so a customer who logs out mid-session doesn't lose an in-progress guest cart either.
@Injectable()
export class CartSessionMiddleware implements NestMiddleware {
  use(req: RequestWithCartSession, res: Response, next: NextFunction) {
    const existing = req.cookies?.[CART_SESSION_COOKIE];
    const guestCartSessionId = existing ?? randomUUID();
    if (!existing) {
      res.cookie(CART_SESSION_COOKIE, guestCartSessionId, {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        maxAge: CART_SESSION_COOKIE_MAX_AGE_MS,
      });
    }
    req.guestCartSessionId = guestCartSessionId;
    next();
  }
}
