import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsBoolean, IsInt, IsObject, IsOptional, IsString, IsUrl, Min, MinLength, ValidateNested } from 'class-validator';

const URL_OPTIONS = { require_tld: false };

// docs/portfolio-spec.md §10.1 — real work-sample metadata only (CV/biography fields are never
// part of this DTO — see the PortfolioItem model's own comment in schema.prisma).
export class CreatePortfolioItemDto {
  @IsString()
  @MinLength(1)
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsUrl(URL_OPTIONS, { each: true })
  mediaUrls!: string[];

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;

  @IsOptional()
  @IsBoolean()
  isFeatured?: boolean;

  @IsOptional()
  @IsUrl(URL_OPTIONS)
  originalArtworkUrl?: string;

  @IsOptional()
  @IsUrl(URL_OPTIONS)
  embroideryResultUrl?: string;

  @IsOptional()
  @IsUrl(URL_OPTIONS)
  closeUpImageUrl?: string;

  @IsOptional()
  @IsUrl(URL_OPTIONS)
  beforeImageUrl?: string;

  @IsOptional()
  @IsUrl(URL_OPTIONS)
  afterImageUrl?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  softwareUsed?: string[];

  @IsOptional()
  @IsString()
  embroideryType?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  stitchCount?: number;

  @IsOptional()
  @IsString()
  sizeLabel?: string;

  @IsOptional()
  @IsString()
  machineFormat?: string;

  @IsOptional()
  @IsString()
  projectNotes?: string;

  // Map of image URL -> alt text (AC-9 — every image needs alt text).
  @IsOptional()
  @IsObject()
  mediaAltTexts?: Record<string, string>;
}

export class UpdatePortfolioItemDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @IsUrl(URL_OPTIONS, { each: true })
  mediaUrls?: string[];

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;

  @IsOptional()
  @IsBoolean()
  isFeatured?: boolean;

  @IsOptional()
  @IsUrl(URL_OPTIONS)
  originalArtworkUrl?: string;

  @IsOptional()
  @IsUrl(URL_OPTIONS)
  embroideryResultUrl?: string;

  @IsOptional()
  @IsUrl(URL_OPTIONS)
  closeUpImageUrl?: string;

  @IsOptional()
  @IsUrl(URL_OPTIONS)
  beforeImageUrl?: string;

  @IsOptional()
  @IsUrl(URL_OPTIONS)
  afterImageUrl?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  softwareUsed?: string[];

  @IsOptional()
  @IsString()
  embroideryType?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  stitchCount?: number;

  @IsOptional()
  @IsString()
  sizeLabel?: string;

  @IsOptional()
  @IsString()
  machineFormat?: string;

  @IsOptional()
  @IsString()
  projectNotes?: string;

  @IsOptional()
  @IsObject()
  mediaAltTexts?: Record<string, string>;
}

class ReorderEntryDto {
  @IsString()
  id!: string;

  @IsInt()
  @Min(0)
  sortOrder!: number;
}

export class ReorderPortfolioDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ReorderEntryDto)
  items!: ReorderEntryDto[];
}
