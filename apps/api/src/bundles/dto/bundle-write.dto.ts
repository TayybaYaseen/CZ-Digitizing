import { IsBoolean, IsNumber, IsOptional, IsString, IsUrl, MaxLength, Min, MinLength } from 'class-validator';

// class-validator's default IsUrl() rejects "localhost" — same relaxation as design-write.dto.ts,
// needed for ImageUploadService's dev-mode API_BASE_URL.
const URL_OPTIONS = { require_tld: false };

// AC-1 — Admin selects a set of published designs, a title, description, preview image, price,
// and optional sale price. Membership itself is managed via the separate /designs sub-resource.
export class CreateBundleDto {
  @IsString()
  @MaxLength(255)
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsUrl(URL_OPTIONS)
  previewImageUrl?: string;

  @IsNumber()
  @Min(0)
  pricePkr!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  salePricePkr?: number;

  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;
}

export class UpdateBundleDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsUrl(URL_OPTIONS)
  previewImageUrl?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  pricePkr?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  salePricePkr?: number;

  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;
}

// AC-7 — per-design price override within a bundle. null clears the override (falls back to
// Design.pricePkr in BundlesService.computeBundleTotal).
export class AddBundleDesignDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  priceOverridePkr?: number;
}
