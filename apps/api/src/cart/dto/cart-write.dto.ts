import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';

// spec §3 — POST /api/cart/items. Exactly one of designId/bundleId (validated in the service,
// where the exclusivity check can see both fields at once — class-validator's per-field
// decorators can't express "exactly one of" cleanly here).
export class AddCartItemDto {
  @IsOptional()
  @IsString()
  designId?: string;

  @IsOptional()
  @IsString()
  bundleId?: string;

  @IsOptional()
  @IsString()
  sizeId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity: number = 1;
}

// spec §3 — PUT /api/cart/items/:itemId, quantity change.
export class UpdateCartItemDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity!: number;
}

// AC-4 — any amountPkr > 0 currently throws INSUFFICIENT_CREDITS (no Credit ledger exists yet,
// A-015 still Blocked); amountPkr: 0 is the idempotent "clear requested credits" no-op.
export class ApplyCreditsDto {
  @Type(() => Number)
  @IsInt()
  @Min(0)
  amountPkr!: number;
}

// docs/specs/2026-08-28-08-orders-payment-processing.md §3 (aspect A-013) — the customer's chosen
// settlement rail, passed through to OrdersService.createFromCart(). Values match the real
// PaymentMethod enum (not PaymentMethodType's display-config-keyed 'credit_card' label) since this
// is what actually processes the order, not what Admin toggles on/off in Settings.
export class CheckoutDto {
  @IsIn(['paypal', 'stripe', 'bank_transfer'])
  paymentMethod!: 'paypal' | 'stripe' | 'bank_transfer';

  // docs/specs/2026-08-28-09-subscriptions-credits.md AC-7 — the amount of the customer's own
  // credit balance to apply against this order's total. Carried on checkout itself rather than
  // persisted as cart state, since ApplyCreditsDto/POST /api/cart/credits is only ever a live
  // pre-validation the frontend calls as the customer types an amount (see CartService.applyCredits).
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  creditsToApplyPkr: number = 0;
}
