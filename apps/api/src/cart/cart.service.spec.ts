import { CartService } from './cart.service';

interface FakeDesign {
  id: bigint;
  name: string;
  previewImageUrl: string;
  pricePkr: number;
  salePricePkr: number | null;
  isPublished: boolean;
  deletedAt: Date | null;
  subcategory: null;
  categoryAssignments: [];
}

interface FakeSize {
  id: bigint;
  designId: bigint;
  sizeLabel: string;
}

interface FakeBundle {
  id: bigint;
  name: string;
  previewImageUrl: string | null;
  pricePkr: number;
  salePricePkr: number | null;
  isPublished: boolean;
  deletedAt: Date | null;
}

interface FakeCart {
  id: bigint;
  customerId: bigint | null;
  guestSessionId: string | null;
  updatedAt: Date;
}

interface FakeCartItem {
  id: bigint;
  cartId: bigint;
  designId: bigint | null;
  bundleId: bigint | null;
  sizeId: bigint | null;
  quantity: number;
  status: 'active' | 'saved_for_later';
  priceAtAddPkr: number;
}

function matches(row: Record<string, unknown>, where: Record<string, unknown>): boolean {
  return Object.entries(where).every(([key, value]) => row[key] === value);
}

function createFakePrisma() {
  const designs = new Map<string, FakeDesign>();
  const sizes = new Map<string, FakeSize>();
  const bundles = new Map<string, FakeBundle>();
  const carts = new Map<string, FakeCart>();
  const cartItems = new Map<string, FakeCartItem>();
  let nextId = 1n;

  function hydrateItem(item: FakeCartItem) {
    return {
      ...item,
      design: item.designId ? designs.get(item.designId.toString())! : null,
      bundle: item.bundleId ? bundles.get(item.bundleId.toString())! : null,
      size: item.sizeId ? sizes.get(item.sizeId.toString())! : null,
    };
  }

  return {
    cart: {
      findUnique: jest.fn(async ({ where, include }: { where: Partial<FakeCart> & { id?: bigint }; include?: unknown }) => {
        const row = [...carts.values()].find((c) => matches(c as unknown as Record<string, unknown>, where as Record<string, unknown>));
        if (!row) return null;
        if (!include) return row;
        return { ...row, items: [...cartItems.values()].filter((i) => i.cartId === row.id).map(hydrateItem) };
      }),
      create: jest.fn(async ({ data }: { data: { customerId?: bigint; guestSessionId?: string } }) => {
        const row: FakeCart = { id: nextId++, customerId: data.customerId ?? null, guestSessionId: data.guestSessionId ?? null, updatedAt: new Date() };
        carts.set(row.id.toString(), row);
        return row;
      }),
      update: jest.fn(async ({ where }: { where: { id: bigint }; data: unknown }) => {
        const row = carts.get(where.id.toString())!;
        row.updatedAt = new Date();
        return row;
      }),
      delete: jest.fn(async ({ where }: { where: { id: bigint } }) => {
        carts.delete(where.id.toString());
      }),
    },
    design: {
      findFirst: jest.fn(async ({ where }: { where: { id: bigint; deletedAt: null } }) => {
        const row = designs.get(where.id.toString());
        return row && row.deletedAt === null ? row : null;
      }),
    },
    designSize: {
      findFirst: jest.fn(async ({ where }: { where: { id: bigint; designId: bigint } }) => {
        const row = sizes.get(where.id.toString());
        return row && row.designId === where.designId ? row : null;
      }),
    },
    designBundle: {
      findFirst: jest.fn(async ({ where }: { where: { id: bigint; deletedAt: null } }) => {
        const row = bundles.get(where.id.toString());
        return row && row.deletedAt === null ? row : null;
      }),
    },
    cartItem: {
      findFirst: jest.fn(async ({ where }: { where: Record<string, unknown> }) => {
        const row = [...cartItems.values()].find((i) => matches(i as unknown as Record<string, unknown>, where));
        return row ? hydrateItem(row) : null;
      }),
      create: jest.fn(async ({ data }: { data: Omit<FakeCartItem, 'id' | 'status'> & { status?: 'active' | 'saved_for_later' } }) => {
        const row: FakeCartItem = {
          id: nextId++,
          cartId: data.cartId,
          designId: data.designId ?? null,
          bundleId: data.bundleId ?? null,
          sizeId: data.sizeId ?? null,
          quantity: data.quantity,
          status: data.status ?? 'active',
          priceAtAddPkr: data.priceAtAddPkr,
        };
        cartItems.set(row.id.toString(), row);
        return row;
      }),
      update: jest.fn(async ({ where, data }: { where: { id: bigint }; data: Partial<FakeCartItem> }) => {
        const row = cartItems.get(where.id.toString())!;
        Object.assign(row, data);
        return row;
      }),
      delete: jest.fn(async ({ where }: { where: { id: bigint } }) => {
        cartItems.delete(where.id.toString());
      }),
      deleteMany: jest.fn(async ({ where }: { where: { cartId: bigint } }) => {
        for (const [key, item] of cartItems) if (item.cartId === where.cartId) cartItems.delete(key);
      }),
    },
    _designs: designs,
    _sizes: sizes,
    _bundles: bundles,
    _nextId: () => nextId++,
  };
}

function fakeOrders() {
  return {
    createFromCart: jest.fn(async (actor: { sub: string }, cart: { items: { status: string }[] }, paymentMethod: string) => ({
      id: 'order-1',
      customerId: actor.sub,
      status: 'payment_pending',
      paymentMethod,
      totalPkr: 0,
      items: cart.items.filter((i) => i.status === 'active'),
    })),
  };
}

// no Credit ledger balance seeded here — mirrors the credits module's own real
// INSUFFICIENT_CREDITS behavior for a customer with a 0 balance.
function fakeCredits() {
  return {
    assertSufficientBalance: jest.fn(async (_customerId: bigint, amountPkr: number) => {
      if (amountPkr > 0) {
        const err = new Error('Only 0 credits are available') as Error & { code: string };
        err.code = 'INSUFFICIENT_CREDITS';
        throw err;
      }
    }),
  };
}

function fakeBundles(prismaFake: ReturnType<typeof createFakePrisma>) {
  return {
    computeBundleTotal: jest.fn(async (bundleId: string) => {
      const bundle = prismaFake._bundles.get(bundleId)!;
      return Number(bundle.salePricePkr ?? bundle.pricePkr);
    }),
  };
}

function seedDesign(prisma: ReturnType<typeof createFakePrisma>, overrides: Partial<FakeDesign> = {}) {
  const id = prisma._nextId();
  const design: FakeDesign = {
    id,
    name: 'Test Design',
    previewImageUrl: 'https://x/1.png',
    pricePkr: 500,
    salePricePkr: null,
    isPublished: true,
    deletedAt: null,
    subcategory: null,
    categoryAssignments: [],
    ...overrides,
  };
  prisma._designs.set(id.toString(), design);
  const sizeId = prisma._nextId();
  prisma._sizes.set(sizeId.toString(), { id: sizeId, designId: id, sizeLabel: 'Standard' });
  return { design, sizeId };
}

function seedBundle(prisma: ReturnType<typeof createFakePrisma>, overrides: Partial<FakeBundle> = {}) {
  const id = prisma._nextId();
  const bundle: FakeBundle = {
    id,
    name: 'Test Bundle',
    previewImageUrl: null,
    pricePkr: 1000,
    salePricePkr: null,
    isPublished: true,
    deletedAt: null,
    ...overrides,
  };
  prisma._bundles.set(id.toString(), bundle);
  return bundle;
}

const GUEST = 'guest-session-1';

describe('CartService (AC-1/2/3/4/5/6/8)', () => {
  it('adds a design with a size and computes subtotal/discount from the live sale price (AC-1/2/3)', async () => {
    const prisma = createFakePrisma();
    const service = new CartService(prisma as never, fakeBundles(prisma) as never, fakeOrders() as never, fakeCredits() as never);
    const { design, sizeId } = seedDesign(prisma, { pricePkr: 1000, salePricePkr: 800 });

    const actor = service.actorFrom(undefined, GUEST);
    await service.addItem(actor, { designId: design.id.toString(), sizeId: sizeId.toString(), quantity: 2 });
    const cart = await service.getCart(actor);

    expect(cart.items).toHaveLength(1);
    expect(cart.items[0].unitPricePkr).toBe(800);
    expect(cart.items[0].lineDiscountPkr).toBe(400); // (1000-800)*2
    expect(cart.subtotalPkr).toBe(2000); // 1000*2 pre-discount
    expect(cart.discountPkr).toBe(400);
    expect(cart.totalPkr).toBe(1600);
  });

  it('adding the same design+size twice increases quantity instead of creating a duplicate line', async () => {
    const prisma = createFakePrisma();
    const service = new CartService(prisma as never, fakeBundles(prisma) as never, fakeOrders() as never, fakeCredits() as never);
    const { design, sizeId } = seedDesign(prisma);
    const actor = service.actorFrom(undefined, GUEST);

    await service.addItem(actor, { designId: design.id.toString(), sizeId: sizeId.toString(), quantity: 1 });
    await service.addItem(actor, { designId: design.id.toString(), sizeId: sizeId.toString(), quantity: 2 });
    const cart = await service.getCart(actor);

    expect(cart.items).toHaveLength(1);
    expect(cart.items[0].quantity).toBe(3);
  });

  it('rejects adding a design without a size (SIZE_REQUIRED)', async () => {
    const prisma = createFakePrisma();
    const service = new CartService(prisma as never, fakeBundles(prisma) as never, fakeOrders() as never, fakeCredits() as never);
    const { design } = seedDesign(prisma);
    const actor = service.actorFrom(undefined, GUEST);

    await expect(service.addItem(actor, { designId: design.id.toString(), quantity: 1 })).rejects.toMatchObject({ code: 'SIZE_REQUIRED' });
  });

  it('rejects adding an unpublished design (ITEM_NOT_PUBLISHED)', async () => {
    const prisma = createFakePrisma();
    const service = new CartService(prisma as never, fakeBundles(prisma) as never, fakeOrders() as never, fakeCredits() as never);
    const { design, sizeId } = seedDesign(prisma, { isPublished: false });
    const actor = service.actorFrom(undefined, GUEST);

    await expect(service.addItem(actor, { designId: design.id.toString(), sizeId: sizeId.toString(), quantity: 1 })).rejects.toMatchObject({
      code: 'ITEM_NOT_PUBLISHED',
    });
  });

  it('adds a bundle using BundlesService.computeBundleTotal() as the unit price (AC-1/AC-7 reuse)', async () => {
    const prisma = createFakePrisma();
    const bundlesFake = fakeBundles(prisma);
    const service = new CartService(prisma as never, bundlesFake as never, fakeOrders() as never, fakeCredits() as never);
    const bundle = seedBundle(prisma, { pricePkr: 1200, salePricePkr: 900 });
    const actor = service.actorFrom(undefined, GUEST);

    await service.addItem(actor, { bundleId: bundle.id.toString(), quantity: 1 });
    const cart = await service.getCart(actor);

    expect(bundlesFake.computeBundleTotal).toHaveBeenCalledWith(bundle.id.toString());
    expect(cart.items[0].unitPricePkr).toBe(900);
  });

  it('saved-for-later items are excluded from cart totals but still listed (AC-8)', async () => {
    const prisma = createFakePrisma();
    const service = new CartService(prisma as never, fakeBundles(prisma) as never, fakeOrders() as never, fakeCredits() as never);
    const { design, sizeId } = seedDesign(prisma, { pricePkr: 500 });
    const actor = service.actorFrom(undefined, GUEST);

    await service.addItem(actor, { designId: design.id.toString(), sizeId: sizeId.toString(), quantity: 1 });
    const added = await service.getCart(actor);
    await service.setStatus(actor, added.items[0].id, 'saved_for_later');
    const after = await service.getCart(actor);

    expect(after.items).toHaveLength(0);
    expect(after.savedForLater).toHaveLength(1);
    expect(after.subtotalPkr).toBe(0);
    expect(after.totalPkr).toBe(0);
  });

  it('merges a guest cart into a customer cart, summing quantities on a matching line (AC-5)', async () => {
    const prisma = createFakePrisma();
    const service = new CartService(prisma as never, fakeBundles(prisma) as never, fakeOrders() as never, fakeCredits() as never);
    const { design, sizeId } = seedDesign(prisma);
    const guestActor = service.actorFrom(undefined, GUEST);
    const customerId = prisma._nextId();

    await service.addItem(guestActor, { designId: design.id.toString(), sizeId: sizeId.toString(), quantity: 2 });
    const customerActor = service.actorFrom({ sub: customerId.toString(), role: 'customer' } as never, GUEST);
    await service.addItem(customerActor, { designId: design.id.toString(), sizeId: sizeId.toString(), quantity: 1 });

    const merged = await service.mergeGuestCartInto(customerId, GUEST);

    expect(merged.items).toHaveLength(1);
    expect(merged.items[0].quantity).toBe(3);
  });

  it('merges distinct guest-only lines into the customer cart untouched (AC-5)', async () => {
    const prisma = createFakePrisma();
    const service = new CartService(prisma as never, fakeBundles(prisma) as never, fakeOrders() as never, fakeCredits() as never);
    const { design: guestDesign, sizeId: guestSizeId } = seedDesign(prisma, { name: 'Guest-only design' });
    const { design: customerDesign, sizeId: customerSizeId } = seedDesign(prisma, { name: 'Customer-only design' });
    const guestActor = service.actorFrom(undefined, GUEST);
    const customerId = prisma._nextId();

    await service.addItem(guestActor, { designId: guestDesign.id.toString(), sizeId: guestSizeId.toString(), quantity: 1 });
    const customerActor = service.actorFrom({ sub: customerId.toString(), role: 'customer' } as never, GUEST);
    await service.addItem(customerActor, { designId: customerDesign.id.toString(), sizeId: customerSizeId.toString(), quantity: 1 });

    const merged = await service.mergeGuestCartInto(customerId, GUEST);

    expect(merged.items.map((i) => i.name).sort()).toEqual(['Customer-only design', 'Guest-only design']);
  });

  it('applyCredits delegates to CreditsService.assertSufficientBalance (AC-4/AC-7, A-015)', async () => {
    const prisma = createFakePrisma();
    const customerId = prisma._nextId();
    const service = new CartService(prisma as never, fakeBundles(prisma) as never, fakeOrders() as never, fakeCredits() as never);
    await expect(service.applyCredits(customerId, 100)).rejects.toMatchObject({ code: 'INSUFFICIENT_CREDITS' });
    await expect(service.applyCredits(customerId, 0)).resolves.toBeUndefined();
  });

  it('checkout validates every active line then hands off to OrdersService.createFromCart (AC-6, A-013)', async () => {
    const prisma = createFakePrisma();
    const orders = fakeOrders();
    const service = new CartService(prisma as never, fakeBundles(prisma) as never, orders as never, fakeCredits() as never);
    const { design, sizeId } = seedDesign(prisma);
    const customerId = prisma._nextId();
    const cartActor = service.actorFrom({ sub: customerId.toString(), role: 'customer' } as never, GUEST);
    await service.addItem(cartActor, { designId: design.id.toString(), sizeId: sizeId.toString(), quantity: 1 });

    const tokenActor = { sub: customerId.toString(), role: 'customer' } as never;
    const order = await service.checkout(tokenActor, 'bank_transfer' as never);

    expect(orders.createFromCart).toHaveBeenCalledWith(tokenActor, expect.anything(), 'bank_transfer', 0);
    expect(order).toMatchObject({ id: 'order-1', paymentMethod: 'bank_transfer' });
  });

  it('checkout rejects with ITEM_NOT_PUBLISHED if a cart line was unpublished after being added', async () => {
    const prisma = createFakePrisma();
    const service = new CartService(prisma as never, fakeBundles(prisma) as never, fakeOrders() as never, fakeCredits() as never);
    const { design, sizeId } = seedDesign(prisma);
    const customerId = prisma._nextId();
    const cartActor = service.actorFrom({ sub: customerId.toString(), role: 'customer' } as never, GUEST);
    await service.addItem(cartActor, { designId: design.id.toString(), sizeId: sizeId.toString(), quantity: 1 });

    design.isPublished = false; // simulate Admin unpublishing after the item was added

    const tokenActor = { sub: customerId.toString(), role: 'customer' } as never;
    await expect(service.checkout(tokenActor, 'bank_transfer' as never)).rejects.toMatchObject({ code: 'ITEM_NOT_PUBLISHED' });
  });

  it('checkout rejects an empty cart', async () => {
    const prisma = createFakePrisma();
    const service = new CartService(prisma as never, fakeBundles(prisma) as never, fakeOrders() as never, fakeCredits() as never);
    const customerId = prisma._nextId();
    const tokenActor = { sub: customerId.toString(), role: 'customer' } as never;
    await expect(service.checkout(tokenActor, 'bank_transfer' as never)).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });
});
