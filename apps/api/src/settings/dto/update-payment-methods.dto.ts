import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsBoolean, IsEnum, IsObject, IsOptional, ValidateNested } from 'class-validator';
import { PaymentMethodType } from '../../generated/prisma';

export class PaymentMethodEntryDto {
  @IsEnum(PaymentMethodType)
  method!: PaymentMethodType;

  @IsBoolean()
  isEnabled!: boolean;

  // Non-secret display config only (bank name/title for display, enabled currency — spec §4/§8
  // risk #2). Never a client secret or account number; those belong in the secrets manager.
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
