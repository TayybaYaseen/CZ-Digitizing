import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put, Req, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import type { AuthenticatedRequest } from '../common/decorators/current-user.decorator';
import { ApiException } from '../common/exceptions/api-exception';
import { RateLimit } from '../common/rate-limit/rate-limit.decorator';
import { generateGuestAccessKey, hashGuestAccessKey, readGuestAccessKey, setGuestAccessCookie } from '../orders/guest-access-key.util';
import type { RequestWithCartSession } from './cart-session.middleware';
import { CartService, type CartActor } from './cart.service';
import { AddCartItemDto, ApplyCreditsDto, CheckoutDto, GuestCheckoutDto, UpdateCartItemDto } from './dto/cart-write.dto';

type CartRequest = AuthenticatedRequest & RequestWithCartSession;

// docs/specs/2026-08-28-07-shopping-cart-checkout.md §3 (aspect A-011). Every route is @Public()
// (guest-or-authenticated) except merge/checkout/credits, which require a real customer (guest
// checkout is its own @Public() route, guest-checkout) — CartSessionMiddleware
// (registered on 'api/cart*' in app.module.ts) has already minted/read the guest cookie into
// req.guestCartSessionId regardless of auth state by the time these handlers run.
@ApiTags('cart')
@Controller('api/cart')
export class CartController {
  constructor(private readonly service: CartService) {}

  private actor(req: CartRequest): CartActor {
    return this.service.actorFrom(req.user, req.guestCartSessionId);
  }

  @Get()
  @Public()
  get(@Req() req: CartRequest) {
    return this.service.getCart(this.actor(req));
  }

  @Post('items')
  @Public()
  @HttpCode(201)
  addItem(@Body() dto: AddCartItemDto, @Req() req: CartRequest) {
    return this.service.addItem(this.actor(req), dto);
  }

  @Put('items/:itemId')
  @Public()
  updateItem(@Param('itemId') itemId: string, @Body() dto: UpdateCartItemDto, @Req() req: CartRequest) {
    return this.service.updateQuantity(this.actor(req), itemId, dto.quantity);
  }

  @Delete('items/:itemId')
  @Public()
  @HttpCode(204)
  async removeItem(@Param('itemId') itemId: string, @Req() req: CartRequest) {
    await this.service.removeItem(this.actor(req), itemId);
  }

  // AC-8 — these don't collide with PUT 'items/:itemId' above; Express matches by segment count,
  // so an extra path segment ('/save-for-later') never gets swallowed by the shorter param route.
  @Put('items/:itemId/save-for-later')
  @Public()
  saveForLater(@Param('itemId') itemId: string, @Req() req: CartRequest) {
    return this.service.setStatus(this.actor(req), itemId, 'saved_for_later');
  }

  @Put('items/:itemId/move-to-cart')
  @Public()
  moveToCart(@Param('itemId') itemId: string, @Req() req: CartRequest) {
    return this.service.setStatus(this.actor(req), itemId, 'active');
  }

  @Delete()
  @Public()
  @HttpCode(204)
  async clear(@Req() req: CartRequest) {
    await this.service.clear(this.actor(req));
  }

  // AC-5 — called by the frontend right after a guest logs in; folds the still-present guest
  // cookie's cart into the now-authenticated customer's cart.
  @Post('merge')
  @Roles('customer')
  merge(@Req() req: CartRequest) {
    return this.service.mergeGuestCartInto(BigInt(req.user!.sub), req.guestCartSessionId);
  }

  @Post('credits')
  @Roles('customer')
  @HttpCode(200)
  async applyCredits(@Body() dto: ApplyCreditsDto, @Req() req: CartRequest) {
    const creditsUsed = await this.service.applyCredits(BigInt(req.user!.sub), dto.amountPkr);
    return { creditsUsed };
  }

  @Post('checkout')
  @Roles('customer')
  @HttpCode(201)
  checkout(@Body() dto: CheckoutDto, @Req() req: CartRequest) {
    return this.service.checkout(req.user, dto.paymentMethod ?? 'bank_transfer', dto.creditsToApplyPkr);
  }

  // Guest checkout — buy without an account. Places the order from this browser's guest cart, and
  // only AFTER the order exists sets (or refreshes) the httpOnly czd_guest_orders cookie holding the
  // browser's guest access key; the order stores just the key's SHA-256. A browser that already has
  // a key keeps it, so every guest order it places stays visible together. The order is ordinary and
  // unpaid at this point (bank transfer: receipt upload, then Admin confirmation) — the cookie gives
  // the browser sight of the order, never its files, which stay locked until payment is confirmed.
  @Post('guest-checkout')
  @Public()
  @RateLimit(10, 60)
  @HttpCode(201)
  async guestCheckout(@Body() dto: GuestCheckoutDto, @Req() req: CartRequest, @Res({ passthrough: true }) res: Response) {
    if (req.user?.role === 'customer') {
      throw new ApiException('GUEST_CHECKOUT_SIGNED_IN', 409, 'You are signed in — please use the normal checkout');
    }
    const key = readGuestAccessKey(req) ?? generateGuestAccessKey();
    const order = await this.service.guestCheckout(req.guestCartSessionId, dto, hashGuestAccessKey(key));
    setGuestAccessCookie(res, key);
    return order;
  }
}
