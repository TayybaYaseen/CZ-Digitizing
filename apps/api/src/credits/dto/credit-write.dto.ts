import { Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator';

export class CreditPackageWriteDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  credits!: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  bonusCredits: number = 0;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  pricePkr!: number;

  @IsOptional()
  @IsBoolean()
  isPublished: boolean = false;
}

// spec §3 — POST /api/credits/purchase.
export class PurchaseCreditsDto {
  @IsString()
  packageId!: string;

  // Bank transfer is the only payment method; any other value is rejected by validation.
  @IsOptional()
  @IsIn(['bank_transfer'])
  paymentMethod?: 'bank_transfer';
}

// AC-10 — gift credits to another customer, identified by email (the only customer-facing
// identifier a sender realistically knows — same as how Admin looks customers up elsewhere).
export class GiftCreditsDto {
  @IsString()
  recipientEmail!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  amount!: number;
}
