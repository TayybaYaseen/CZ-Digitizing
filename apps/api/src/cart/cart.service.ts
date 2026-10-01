import { Injectable } from '@nestjs/common';
import { Prisma } from '../generated/prisma';
import type { Cart, PaymentMethod, User } from '../generated/prisma';
import type { AccessTokenPayload } from '../auth/token.types';
import { ActivityService } from '../activity/activity.service';
import { BundlesService } from '../bundles/bundles.service';
import { ApiException } from '../common/exceptions/api-exception';
import { CreditsService } from '../credits/credits.service';
import type { GuestOrderDto, OrderDto } from '../orders/dto/order.dto';
import { OrdersService } from '../orders/orders.service';
import { PrismaService } from '../prisma/prisma.service';
import type { AddCartItemDto, GuestCheckoutDto } from './dto/cart-write.dto';
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
    private readonly credits: CreditsService,
    private readonly activity: ActivityService,
  ) {}

  // Only role=customer requests resolve to a customer-linked cart — admin/freelancer/moderator
  // requests (and anonymous ones) always fall back to the guest-session cookie, since carts are a
  // customer-purchasing concept, not a staff one. Mirrors the role==='customer' check every other
  // "optional customer" call site in this repo uses (e.g. designs/staff-visibility.util.ts).
  actorFrom(user: AccessTokenPayload | undefined, guestSessionId: string): CartActor {
    return { customerId: user?.role === 'customer' ? BigInt(user.sub) : undefined, guestSessionId };
  }

  private async resolveCart(actor: CartActor): Promise<Cart> {
    const where = actor.customerId !== undefined ? { customerId: actor.customerId } : { guestSessionId: actor.guestSessionId };
    const existing = await this.prisma.cart.findUnique({ where });
    if (existing) return existing;
    try {
      return await this.prisma.cart.create({ data: where });
    } catch (err) {
      // Right after sign-in apps/web fires POST /api/cart/merge and a cart read at the same
      // moment — both can see "no cart yet" and both insert. The loser hits the unique constraint
      // (P2002) and simply takes the row the winner just created. Not an upsert: its update
      // branch would bump updatedAt on every read, which CartCleanupService's staleness sweep
      // keys off.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        return this.prisma.cart.findUniqueOrThrow({ where });
      }
      throw err;
    }
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
    let resultItem: { id: bigint; quantity: number };

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
        // AC-15 — an atomic DB-level increment, not existing.quantity + dto.quantity computed in
        // JS: two near-simultaneous adds of the same line (e.g. web and app within the same
        // second) would otherwise both read the same pre-update quantity and one increment would
        // be silently lost, which is a real lost-update bug, not the "standard last-write-wins"
        // this spec's AC-15 actually claims.
        resultItem = await this.prisma.cartItem.update({ where: { id: existing.id }, data: { quantity: { increment: dto.quantity } } });
      } else {
        resultItem = await this.prisma.cartItem.create({
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
        // AC-15 — atomic increment, same reasoning as the design branch above.
        resultItem = await this.prisma.cartItem.update({ where: { id: existing.id }, data: { quantity: { increment: dto.quantity } } });
      } else {
        resultItem = await this.prisma.cartItem.create({ data: { cartId: cart.id, bundleId: bundle.id, quantity: dto.quantity, priceAtAddPkr } });
      }
    }

    // AC-10 — guests have no customer identity to attach the event to; only authenticated
    // customers get activity tracked (same posture as every other "optional customer" call site).
    // Keyed on the item's post-mutation quantity, not a raw timestamp: a genuinely repeated add
    // strictly increases quantity each time (a fresh, distinct key), while a network-level retry of
    // the exact same add lands on the same resulting quantity and collapses per AC-15.
    if (actor.customerId !== undefined) {
      await this.activity.record({
        customerId: actor.customerId,
        eventType: 'ADDED_TO_CART',
        designId: dto.designId ? BigInt(dto.designId) : undefined,
        cartItemId: resultItem.id.toString(),
        source: 'web',
        idempotencyKey: `${actor.customerId}:ADDED_TO_CART:${resultItem.id}:${resultItem.quantity}`,
      });
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

    // AC-10/AC-15 — naturally idempotent without a quantity/timestamp component: once itemId is
    // deleted, findOwnItemOrThrow above 404s on any retry before this point is ever reached again.
    if (actor.customerId !== undefined) {
      await this.activity.record({
        customerId: actor.customerId,
        eventType: 'REMOVED_FROM_CART',
        designId: item.designId ?? undefined,
        cartItemId: itemId,
        source: 'web',
        idempotencyKey: `${actor.customerId}:REMOVED_FROM_CART:${itemId}`,
      });
    }
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
          await this.prisma.cartItem.update({ where: { id: existing.id }, data: { quantity: { increment: guestItem.quantity } } });
        } else {
          await this.prisma.cartItem.update({ where: { id: guestItem.id }, data: { cartId: customerCart.id } });
        }
      }
      await this.prisma.cart.delete({ where: { id: guestCart.id } });
    }

    return this.toDto(await this.loadCartWithItems(customerCart.id));
  }

  // AC-4/AC-7 (subscriptions-credits spec) — real balance pre-check; the actual deduction happens
  // inside OrdersService.createFromCart() at checkout (see this.checkout()'s creditsToApplyPkr
  // param below), so this is a live "can I apply this much" validation the frontend can call as
  // the customer types an amount, without it mutating anything itself.
  // A-013 — returns the amount that would ACTUALLY be applied: never more than the cart total, so
  // the checkout screen can't promise (or later consume) 5,000 credits against a Rs 1,500 order.
  async applyCredits(customerId: bigint, amountPkr: number): Promise<number> {
    const cart = await this.getCart({ customerId, guestSessionId: '' });
    const applied = Math.min(amountPkr, cart.totalPkr);
    if (applied > 0) await this.credits.assertSufficientBalance(customerId, applied);
    return applied;
  }

  // AC-6 — real pre-checkout validation (every active line still published, every design line
  // still has its size) runs before handing off to OrdersService.createFromCart(), which snapshots
  // the validated active lines into a real Order and clears them from the cart on success (spec
  // 2026-08-28-08-orders-payment-processing.md, aspect A-013 — no longer a stub).
  async checkout(actor: AccessTokenPayload, paymentMethod: PaymentMethod, creditsToApplyPkr = 0): Promise<OrderDto> {
    const cart = await this.loadCartWithItems((await this.resolveCart({ customerId: BigInt(actor.sub), guestSessionId: '' })).id);
    this.assertCheckoutable(cart);

    // The credits balance is enforced inside OrdersService.createFromCart()'s own transaction, on
    // the amount actually consumed (capped at the order total) — checking the raw requested amount
    // here would wrongly reject "apply 5,000" from a customer whose 2,000 balance covers the order.
    return this.orders.createFromCart(actor, cart, paymentMethod, creditsToApplyPkr);
  }

  // Guest checkout — POST /api/cart/guest-checkout: buy without registering or signing in. Checks out
  // the guest-session cart (czd_cart_session) through the very same validation and
  // OrdersService.createFromCart() as a signed-in checkout, so the order, its bank-transfer payment,
  // receipt review and file release are the ordinary ones. What differs:
  //   - the order's customer is the guest customer identity for the email typed (see
  //     resolveGuestCustomer), so emails/notifications reach the buyer and a later sign-in with that
  //     email simply finds the order already on the account — nothing is copied or moved;
  //   - the order carries guestAccessKeyHash, the hash of the browser's guest key (set as a cookie by
  //     the controller only after this returns, i.e. only once the order really exists);
  //   - no credits are ever applied.
  async guestCheckout(guestSessionId: string, dto: GuestCheckoutDto, guestAccessKeyHash: string): Promise<GuestOrderDto> {
    const existingCart = await this.prisma.cart.findUnique({ where: { guestSessionId } });
    if (!existingCart) throw new ApiException('VALIDATION_ERROR', 400, 'Cart is empty');
    const cart = await this.loadCartWithItems(existingCart.id);
    this.assertCheckoutable(cart);

    const customer = await this.resolveGuestCustomer(dto.email, dto.name);
    const order = await this.orders.createFromCart({ sub: customer.id.toString() }, cart, dto.paymentMethod ?? 'bank_transfer', 0, {
      accessKeyHash: guestAccessKeyHash,
      contactName: dto.name,
      contactWhatsapp: dto.whatsapp ?? null,
    });
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { customerId, ...guestOrder } = order;
    return guestOrder;
  }

  // The customer an order placed without signing in belongs to, matched on the email
  // case-insensitively:
  //   - no account yet  -> a new guest identity (User.isGuest, no password). It cannot be signed in
  //     to until someone proves they own the email (every sign-in path emails a code/link first);
  //   - an existing customer account (guest or registered) -> that account. The guest browser still
  //     only ever sees the orders it placed itself (its key), never the account's other orders, and
  //     the account's profile is never touched — the typed name/WhatsApp go on the order instead;
  //   - a staff or disabled account -> refused: it must sign in (it must not be able to buy around
  //     a suspension, and staff accounts are not customers).
  private async resolveGuestCustomer(rawEmail: string, name: string): Promise<User> {
    const email = rawEmail.trim().toLowerCase();
    const assertUsable = (user: User): User => {
      if (user.role !== 'customer' || user.status !== 'active') {
        throw new ApiException('GUEST_CHECKOUT_SIGN_IN_REQUIRED', 409, 'Please sign in to place an order with this email address');
      }
      return user;
    };
    const find = () => this.prisma.user.findFirst({ where: { email: { equals: email, mode: 'insensitive' } }, orderBy: { id: 'asc' } });

    const existing = await find();
    if (existing) return assertUsable(existing);
    try {
      return await this.prisma.user.create({ data: { email, displayName: name, role: 'customer', isGuest: true } });
    } catch (err) {
      // Two guest checkouts for the same new email at once: the loser takes the row the winner made.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        const winner = await find();
        if (winner) return assertUsable(winner);
      }
      throw err;
    }
  }

  // AC-6 — real pre-checkout validation (every active line still published, every design line still
  // has its size), shared by the signed-in and guest checkouts.
  private assertCheckoutable(cart: CartWithItems): void {
    const active = cart.items.filter((i) => i.status === 'active');
    if (active.length === 0) throw new ApiException('VALIDATION_ERROR', 400, 'Cart is empty');

    for (const item of active) {
      const published = item.design?.isPublished ?? item.bundle?.isPublished ?? false;
      if (!published) throw new ApiException('ITEM_NOT_PUBLISHED', 422, `"${item.design?.name ?? item.bundle?.name}" is no longer available`);
      if (item.designId && !item.sizeId) throw new ApiException('SIZE_REQUIRED', 422, `A size must be selected for "${item.design?.name}"`);
    }
  }

  private async findOwnItemOrThrow(actor: CartActor, itemId: string): Promise<CartItemWithRelations> {
    const cart = await this.resolveCart(actor);
    const item = await this.prisma.cartItem.findFirst({ where: { id: BigInt(itemId), cartId: cart.id }, include: CART_ITEM_INCLUDE });
    if (!item) throw new ApiException('RESOURCE_NOT_FOUND', 404, 'Cart item not found');
    return item;
  }
}
