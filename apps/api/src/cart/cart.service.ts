import { Injectable } from '@nestjs/common';
import type { Cart, PaymentMethod, Prisma } from '../generated/prisma';
import type { AccessTokenPayload } from '../auth/token.types';
import { BundlesService } from '../bundles/bundles.service';
import { ApiException } from '../common/exceptions/api-exception';
import type { OrderDto } from '../orders/dto/order.dto';
import { OrdersService } from '../orders/orders.service';
import { PrismaService } from '../prisma/prisma.service';
import type { AddCartItemDto } from './dto/cart-write.dto';
import { toCartDto, toCartItemDto, type CartDto, type CartItemWithRelations, type CartWithItems } from './dto/cart.dto';

const CART_ITEM_INCLUDE = {
  design: { include: { subcategory: true, categoryAssignments: { include: { category: true } } } },
  bundle: true,
  size: true,
} satisfies Prisma.CartItemInclude;

const CART_INCLUDE = { items: { include: CART_ITEM_INCLUDE } } satisfies Prisma.CartInclude;

export interface CartActor {
  customerId?: bigint;
  guestSessionId: string;
}

// docs/specs/2026-08-28-07-shopping-cart-checkout.md §3/§4 (aspect A-011).
@Injectable()
export class CartService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bundles: BundlesService,
    private readonly orders: OrdersService,
  ) {}

  // Only role=customer requests resolve to a customer-linked cart — admin/freelancer/moderator
  // requests (and anonymous ones) always fall back to the guest-session cookie, since carts are a
  // customer-purchasing concept, not a staff one. Mirrors the role==='customer' check every other
  // "optional customer" call site in this repo uses (e.g. designs/staff-visibility.util.ts).
  actorFrom(user: AccessTokenPayload | undefined, guestSessionId: string): CartActor {
    return { customerId: user?.role === 'customer' ? BigInt(user.sub) : undefined, guestSessionId };
  }

  private async resolveCart(actor: CartActor): Promise<Cart> {
    if (actor.customerId !== undefined) {
      const existing = await this.prisma.cart.findUnique({ where: { customerId: actor.customerId } });
      if (existing) return existing;
      return this.prisma.cart.create({ data: { customerId: actor.customerId } });
    }
    const existing = await this.prisma.cart.findUnique({ where: { guestSessionId: actor.guestSessionId } });
    if (existing) return existing;
    return this.prisma.cart.create({ data: { guestSessionId: actor.guestSessionId } });
  }

  private async loadCartWithItems(cartId: bigint): Promise<CartWithItems> {
    const cart = await this.prisma.cart.findUnique({ where: { id: cartId }, include: CART_INCLUDE });
    if (!cart) throw new ApiException('RESOURCE_NOT_FOUND', 404, 'Cart not found');
    return cart;
  }

  private async toDto(cart: CartWithItems): Promise<CartDto> {
    // Bundle line totals need one computeBundleTotal() call per distinct bundle — reused across
    // items::AC-7's price-override sum stays the single source of truth for a bundle's price.
    const bundleTotals = new Map<string, number>();
    for (const item of cart.items) {
      if (item.bundleId && !bundleTotals.has(item.bundleId.toString())) {
        bundleTotals.set(item.bundleId.toString(), await this.bundles.computeBundleTotal(item.bundleId.toString()));
      }
    }
    const itemDtos = cart.items.map((item) => toCartItemDto(item, item.bundleId ? bundleTotals.get(item.bundleId.toString()) : undefined));
    return toCartDto(itemDtos);
  }

  async getCart(actor: CartActor): Promise<CartDto> {
    const cart = await this.resolveCart(actor);
    return this.toDto(await this.loadCartWithItems(cart.id));
  }

  // AC-1 — validates ITEM_NOT_PUBLISHED/SIZE_REQUIRED, then upserts quantity onto an existing
  // matching active line (same design+size or same bundle) rather than creating a duplicate row.
  async addItem(actor: CartActor, dto: AddCartItemDto): Promise<CartDto> {
    if ((dto.designId && dto.bundleId) || (!dto.designId && !dto.bundleId)) {
      throw new ApiException('VALIDATION_ERROR', 400, 'Provide exactly one of designId or bundleId');
    }

    const cart = await this.resolveCart(actor);
    let priceAtAddPkr: number;

    if (dto.designId) {
      const design = await this.prisma.design.findFirst({ where: { id: BigInt(dto.designId), deletedAt: null } });
      if (!design) throw new ApiException('RESOURCE_NOT_FOUND', 404, 'Design not found');
      if (!design.isPublished) throw new ApiException('ITEM_NOT_PUBLISHED', 422, 'This design is no longer available');
      if (!dto.sizeId) throw new ApiException('SIZE_REQUIRED', 422, 'A size must be selected for this design');
      const size = await this.prisma.designSize.findFirst({ where: { id: BigInt(dto.sizeId), designId: design.id } });
      if (!size) throw new ApiException('RESOURCE_NOT_FOUND', 404, 'Size not found for this design');
      priceAtAddPkr = Number(design.salePricePkr ?? design.pricePkr);

      const existing = await this.prisma.cartItem.findFirst({
        where: { cartId: cart.id, designId: design.id, sizeId: size.id, status: 'active' },
      });
      if (existing) {
        await this.prisma.cartItem.update({ where: { id: existing.id }, data: { quantity: existing.quantity + dto.quantity } });
      } else {
        await this.prisma.cartItem.create({
          data: { cartId: cart.id, designId: design.id, sizeId: size.id, quantity: dto.quantity, priceAtAddPkr },
        });
      }
    } else {
      const bundle = await this.prisma.designBundle.findFirst({ where: { id: BigInt(dto.bundleId!), deletedAt: null } });
      if (!bundle) throw new ApiException('RESOURCE_NOT_FOUND', 404, 'Bundle not found');
      if (!bundle.isPublished) throw new ApiException('ITEM_NOT_PUBLISHED', 422, 'This bundle is no longer available');
      priceAtAddPkr = await this.bundles.computeBundleTotal(bundle.id.toString());

      const existing = await this.prisma.cartItem.findFirst({ where: { cartId: cart.id, bundleId: bundle.id, status: 'active' } });
      if (existing) {
        await this.prisma.cartItem.update({ where: { id: existing.id }, data: { quantity: existing.quantity + dto.quantity } });
      } else {
        await this.prisma.cartItem.create({ data: { cartId: cart.id, bundleId: bundle.id, quantity: dto.quantity, priceAtAddPkr } });
      }
    }

    await this.touch(cart.id);
    return this.toDto(await this.loadCartWithItems(cart.id));
  }

  async updateQuantity(actor: CartActor, itemId: string, quantity: number): Promise<CartDto> {
    const item = await this.findOwnItemOrThrow(actor, itemId);
    await this.prisma.cartItem.update({ where: { id: item.id }, data: { quantity } });
    await this.touch(item.cartId);
    return this.toDto(await this.loadCartWithItems(item.cartId));
  }

  async removeItem(actor: CartActor, itemId: string): Promise<void> {
    const item = await this.findOwnItemOrThrow(actor, itemId);
    await this.prisma.cartItem.delete({ where: { id: item.id } });
    await this.touch(item.cartId);
  }

  // AC-8 — moves a line to/from the Saved-for-Later list without touching quantity/price.
  async setStatus(actor: CartActor, itemId: string, status: 'active' | 'saved_for_later'): Promise<CartDto> {
    const item = await this.findOwnItemOrThrow(actor, itemId);
    await this.prisma.cartItem.update({ where: { id: item.id }, data: { status } });
    await this.touch(item.cartId);
    return this.toDto(await this.loadCartWithItems(item.cartId));
  }

  // "Clear cart" removes every line, active and saved — the literal reading of DELETE /api/cart.
  async clear(actor: CartActor): Promise<void> {
    const cart = await this.resolveCart(actor);
    await this.prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
    await this.touch(cart.id);
  }

  // Bumps Cart.updatedAt on every mutation (Prisma's @updatedAt only fires on a write to the Cart
  // row itself, not its child cart_items) — CartCleanupService's 30-day guest-cart sweep (spec §4)
  // keys off this column, so an active guest cart must never look stale just because only its
  // items, not the cart row, were touched.
  private async touch(cartId: bigint): Promise<void> {
    await this.prisma.cart.update({ where: { id: cartId }, data: {} });
  }

  // AC-5 — folds a guest cart's items into the customer's cart (sum quantities on matching
  // design+size/bundle lines, keep every other line), then removes the now-empty guest cart. Never
  // overwrites — a customer who already had cart items keeps them plus whatever the guest session
  // added.
  async mergeGuestCartInto(customerId: bigint, guestSessionId: string): Promise<CartDto> {
    const guestCart = await this.prisma.cart.findUnique({ where: { guestSessionId }, include: { items: true } });
    const customerCart = await this.resolveCart({ customerId, guestSessionId });

    if (guestCart && guestCart.id !== customerCart.id) {
      for (const guestItem of guestCart.items) {
        const existing = await this.prisma.cartItem.findFirst({
          where: {
            cartId: customerCart.id,
            status: guestItem.status,
            ...(guestItem.designId ? { designId: guestItem.designId, sizeId: guestItem.sizeId } : { bundleId: guestItem.bundleId }),
          },
        });
        if (existing) {
          await this.prisma.cartItem.update({ where: { id: existing.id }, data: { quantity: existing.quantity + guestItem.quantity } });
        } else {
          await this.prisma.cartItem.update({ where: { id: guestItem.id }, data: { cartId: customerCart.id } });
        }
      }
      await this.prisma.cart.delete({ where: { id: guestCart.id } });
    }

    return this.toDto(await this.loadCartWithItems(customerCart.id));
  }

  // AC-4 — real validation; no Credit ledger exists yet (A-015 Subscriptions & Credits, still
  // Blocked per docs/specs/SPEC_INDEX.md), so available balance is definitionally 0.
  // TODO(A-015): replace the hardcoded 0 with a real balance lookup once a Credit model exists.
  applyCredits(amountPkr: number): void {
    const availableCreditsPkr = 0;
    if (amountPkr > availableCreditsPkr) {
      throw new ApiException('INSUFFICIENT_CREDITS', 422, `Only ${availableCreditsPkr} PKR in credits is available`);
    }
  }

  // AC-6 — real pre-checkout validation (every active line still published, every design line
  // still has its size) runs before handing off to OrdersService.createFromCart(), which snapshots
  // the validated active lines into a real Order and clears them from the cart on success (spec
  // 2026-08-28-08-orders-payment-processing.md, aspect A-013 — no longer a stub).
  async checkout(actor: AccessTokenPayload, paymentMethod: PaymentMethod): Promise<OrderDto> {
    const cart = await this.loadCartWithItems((await this.resolveCart({ customerId: BigInt(actor.sub), guestSessionId: '' })).id);
    const active = cart.items.filter((i) => i.status === 'active');
    if (active.length === 0) throw new ApiException('VALIDATION_ERROR', 400, 'Cart is empty');

    for (const item of active) {
      const published = item.design?.isPublished ?? item.bundle?.isPublished ?? false;
      if (!published) throw new ApiException('ITEM_NOT_PUBLISHED', 422, `"${item.design?.name ?? item.bundle?.name}" is no longer available`);
      if (item.designId && !item.sizeId) throw new ApiException('SIZE_REQUIRED', 422, `A size must be selected for "${item.design?.name}"`);
    }

    return this.orders.createFromCart(actor, cart, paymentMethod);
  }

  private async findOwnItemOrThrow(actor: CartActor, itemId: string): Promise<CartItemWithRelations> {
    const cart = await this.resolveCart(actor);
    const item = await this.prisma.cartItem.findFirst({ where: { id: BigInt(itemId), cartId: cart.id }, include: CART_ITEM_INCLUDE });
    if (!item) throw new ApiException('RESOURCE_NOT_FOUND', 404, 'Cart item not found');
    return item;
  }
}
