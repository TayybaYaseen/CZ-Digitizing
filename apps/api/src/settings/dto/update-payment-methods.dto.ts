import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsBoolean, IsEnum, IsObject, IsOptional, ValidateNested } from 'class-validator';
import { PaymentMethodType } from '../../generated/prisma';

export class PaymentMethodEntryDto {
  @IsEnum(PaymentMethodType)
  method!: PaymentMethodType;

  @IsBoolean()
  isEnabled!: boolean;

  // Non-secret display config: for bank_transfer, the account details a customer transfers
  // money INTO (bankName/accountTitle/accountNumber/iban) — necessarily customer-visible, not a
  // secret, per docs/specs/2026-08-28-08-orders-payment-processing.md AC-3/AC-9. Real API
  // credentials (PayPal client secret, Stripe secret key) never go here — those stay in .env,
  // per that spec's own §8 risk #2 note.
  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;
}

// AC-2/AC-10 — past order records retain the payment details active at order time; only future
// checkouts see this update (enforced by A-013's own Order snapshot once that aspect exists).
export class UpdatePaymentMethodsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PaymentMethodEntryDto)
  methods!: PaymentMethodEntryDto[];
}
