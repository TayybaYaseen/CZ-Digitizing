import { Transform, Type } from 'class-transformer';
import { IsEmail, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Matches, MaxLength, Min } from 'class-validator';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

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

// docs/specs/2026-08-28-08-orders-payment-processing.md §3/§11 (aspect A-013) — bank transfer is the
// only payment method. `paymentMethod` is optional (it can only ever be 'bank_transfer'); any other value
// is rejected by validation, not silently accepted.
export class CheckoutDto {
  @IsOptional()
  @IsIn(['bank_transfer'])
  paymentMethod?: 'bank_transfer';

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

// Guest checkout — POST /api/cart/guest-checkout. Only what is needed to identify and contact the
// buyer: a name, the email that receives the order confirmation and status emails (and is the
// address they later sign in / recover with), and an optional WhatsApp number for Admin to reach
// them. No credits field: credits belong to an account and need a signed-in session.
export class GuestCheckoutDto {
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @Transform(trim)
  @IsEmail()
  @MaxLength(254)
  email!: string;

  // Digits with optional leading +, spaces, dashes, dots or parentheses — what people actually type.
  // The message is a translation key the customer site renders in the active language.
  @Transform(({ value }) => (typeof value === 'string' && value.trim() === '' ? undefined : trim({ value })))
  @IsOptional()
  @IsString()
  @MaxLength(32)
  @Matches(/^\+?[0-9][0-9 ().-]{5,30}$/, { message: 'validation.whatsapp' })
  whatsapp?: string;

  @IsOptional()
  @IsIn(['bank_transfer'])
  paymentMethod?: 'bank_transfer';
}
