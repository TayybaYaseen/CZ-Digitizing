import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import type { AuthenticatedRequest } from '../common/decorators/current-user.decorator';
import type { RequestWithCartSession } from './cart-session.middleware';
import { CartService, type CartActor } from './cart.service';
import { AddCartItemDto, ApplyCreditsDto, CheckoutDto, UpdateCartItemDto } from './dto/cart-write.dto';

type CartRequest = AuthenticatedRequest & RequestWithCartSession;

// docs/specs/2026-08-28-07-shopping-cart-checkout.md §3 (aspect A-011). Every route is @Public()
// (guest-or-authenticated) except merge/checkout, which require a real customer — CartSessionMiddleware
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
  applyCredits(@Body() dto: ApplyCreditsDto) {
    this.service.applyCredits(dto.amountPkr);
    return { creditsUsed: 0 };
  }

  @Post('checkout')
  @Roles('customer')
  @HttpCode(201)
  checkout(@Body() dto: CheckoutDto, @Req() req: CartRequest) {
    return this.service.checkout(req.user, dto.paymentMethod);
  }
}
