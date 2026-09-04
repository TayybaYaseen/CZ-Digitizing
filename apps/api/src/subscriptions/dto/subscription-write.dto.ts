import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsIn, IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator';

export class SubscriptionPlanWriteDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsIn(['monthly', 'yearly'])
  billingPeriod!: 'monthly' | 'yearly';

  @Type(() => Number)
  @IsInt()
  @Min(0)
  pricePkr!: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  monthlyCredits!: number;

  // Monthly logo/design-file download allowance this plan grants. Omit/null = unlimited.
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  logoLimit?: number | null;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  perks: string[] = [];

  @IsOptional()
  @IsBoolean()
  isBestValue: boolean = false;

  @IsOptional()
  @IsBoolean()
  isPublished: boolean = false;
}

// spec §3 — POST /api/subscriptions/subscribe.
export class SubscribeDto {
  @IsString()
  planId!: string;

  @IsIn(['paypal', 'stripe'])
  paymentMethod!: 'paypal' | 'stripe';
}

// AC-9 — upgrade/downgrade mid-cycle.
export class ChangePlanDto {
  @IsString()
  planId!: string;
}
