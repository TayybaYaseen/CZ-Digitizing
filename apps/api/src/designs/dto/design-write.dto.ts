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

  @IsUrl()
  previewImageUrl!: string;

  @IsOptional()
  @IsArray()
  @IsUrl({}, { each: true })
  galleryImageUrls?: string[];

  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  categoryIds!: string[];

  @IsOptional()
  @IsString()
  subcategoryId?: string;

  @IsOptional()
  @IsUrl()
  vectorImageUrl?: string;

  @IsOptional()
  @IsUrl()
  vectorVideoUrl?: string;

  @IsOptional()
  @IsUrl()
  embroideryImageUrl?: string;

  @IsOptional()
  @IsUrl()
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
  @IsUrl()
  previewImageUrl?: string;

  @IsOptional()
  @IsArray()
  @IsUrl({}, { each: true })
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
  @IsUrl()
  vectorImageUrl?: string;

  @IsOptional()
  @IsUrl()
  vectorVideoUrl?: string;

  @IsOptional()
  @IsUrl()
  embroideryImageUrl?: string;

  @IsOptional()
  @IsUrl()
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
