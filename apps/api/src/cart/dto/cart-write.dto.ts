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

// Present for documentation/symmetry with the DTO-per-route convention even though this route
// currently takes no body — kept minimal rather than omitted so a future field (e.g. a chosen
// payment method) has an obvious home.
export class CheckoutDto {
  @IsOptional()
  @IsIn(['paypal', 'bank_transfer', 'credit_card'])
  paymentMethod?: 'paypal' | 'bank_transfer' | 'credit_card';
}
