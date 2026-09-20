import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsBoolean, IsEnum, IsObject, IsOptional, ValidateNested } from 'class-validator';
import { PaymentMethodType } from '../../generated/prisma';

export class PaymentMethodEntryDto {
  @IsEnum(PaymentMethodType)
  method!: PaymentMethodType;

  @IsBoolean()
  isEnabled!: boolean;

  // The bank account a customer transfers PKR into: bankName / accountTitle / accountNumber / iban /
  // instructions (any other key is dropped by PlatformSettingsService). Necessarily customer-visible,
  // so it is display config, not a secret — docs/specs/2026-08-28-08-orders-payment-processing.md AC-3/AC-9.
  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;
}

// AC-2/AC-9 — bank transfer is the only payment method; checkout / payment pages read these details
// live, so a change applies to the very next page view. Amounts on past orders are unaffected.
export class UpdatePaymentMethodsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PaymentMethodEntryDto)
  methods!: PaymentMethodEntryDto[];
}
