import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

// class-validator's default IsUrl() rejects "localhost" (no dot-TLD) — which is exactly what
// ImageUploadService's dev-mode API_BASE_URL produces (http://localhost:4000/uploads/...). Every
// design media URL field uses this relaxed option so a locally-uploaded image/video URL validates
// the same way a real https://... URL does; this stays correct in production too (require_tld:
// false is a superset, not a hole — it just stops requiring a TLD, it doesn't skip protocol/host
// structure checks).
const URL_OPTIONS = { require_tld: false };

export class DesignSizeInputDto {
  @IsString()
  @MaxLength(50)
  label!: string;

  @IsNumber()
  @Min(0)
  widthMm!: number;

  @IsNumber()
  @Min(0)
  heightMm!: number;
}

// AC-1 — at least one category is required. sizes: at least one entry (spec §3 validation note).
export class CreateDesignDto {
  @IsString()
  @MaxLength(255)
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsUrl(URL_OPTIONS)
  previewImageUrl!: string;

  @IsOptional()
  @IsArray()
  @IsUrl(URL_OPTIONS, { each: true })
  galleryImageUrls?: string[];

  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  categoryIds!: string[];

  @IsOptional()
  @IsString()
  subcategoryId?: string;

  @IsOptional()
  @IsUrl(URL_OPTIONS)
  vectorImageUrl?: string;

  @IsOptional()
  @IsUrl(URL_OPTIONS)
  vectorVideoUrl?: string;

  @IsOptional()
  @IsUrl(URL_OPTIONS)
  embroideryImageUrl?: string;

  @IsOptional()
  @IsUrl(URL_OPTIONS)
  embroideryVideoUrl?: string;

  @IsOptional()
  @IsBoolean()
  autoSwapEnabled?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsNumber()
  @Min(0)
  pricePkr!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  salePricePkr?: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  discountBadge?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  stitchCount?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  threadColorCount?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  threadColorChanges?: number;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => DesignSizeInputDto)
  sizes!: DesignSizeInputDto[];

  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;
}

export class UpdateDesignDto {
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
  @IsArray()
  @IsUrl(URL_OPTIONS, { each: true })
  galleryImageUrls?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  categoryIds?: string[];

  @IsOptional()
  @IsString()
  subcategoryId?: string;

  @IsOptional()
  @IsUrl(URL_OPTIONS)
  vectorImageUrl?: string;

  @IsOptional()
  @IsUrl(URL_OPTIONS)
  vectorVideoUrl?: string;

  @IsOptional()
  @IsUrl(URL_OPTIONS)
  embroideryImageUrl?: string;

  @IsOptional()
  @IsUrl(URL_OPTIONS)
  embroideryVideoUrl?: string;

  @IsOptional()
  @IsBoolean()
  autoSwapEnabled?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsNumber()
  @Min(0)
  pricePkr?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  salePricePkr?: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  discountBadge?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  stitchCount?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  threadColorCount?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  threadColorChanges?: number;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => DesignSizeInputDto)
  sizes?: DesignSizeInputDto[];

  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;
}
