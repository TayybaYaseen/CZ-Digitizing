import { IsBoolean, IsInt, IsNumber, IsOptional, IsString, Min, MinLength } from 'class-validator';
import type { DynamicBundleRule } from '../../generated/prisma';

// AC-6 — "any N designs from Category X for Y PKR" dynamic bundle rule. Modeled and
// admin-manageable now; automatic application at checkout is TODO(A-011), see
// dynamic-bundle-rules.service.ts.
export interface DynamicBundleRuleDto {
  id: string;
  name: string;
  categoryId: string;
  requiredDesignCount: number;
  bundlePricePkr: number;
  isPublished: boolean;
}

export function toDynamicBundleRuleDto(rule: DynamicBundleRule): DynamicBundleRuleDto {
  return {
    id: rule.id.toString(),
    name: rule.name,
    categoryId: rule.categoryId.toString(),
    requiredDesignCount: rule.requiredDesignCount,
    bundlePricePkr: Number(rule.bundlePricePkr),
    isPublished: rule.isPublished,
  };
}

export class CreateDynamicBundleRuleDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsString()
  categoryId!: string;

  @IsInt()
  @Min(1)
  requiredDesignCount!: number;

  @IsNumber()
  @Min(0)
  bundlePricePkr!: number;

  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;
}

export class UpdateDynamicBundleRuleDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  requiredDesignCount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  bundlePricePkr?: number;

  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;
}
