import { IsArray, IsBoolean, IsDateString, IsOptional, IsString, IsUrl, MinLength } from 'class-validator';

const URL_OPTIONS = { require_tld: false };

// AC-3 — "category OR specific designs" (spec §8 risk #2): exactly one of targetCategoryId /
// targetDesignIds may be set, application-layer enforced in AdvertisementsService.
export class CreateAdvertisementDto {
  @IsString()
  @MinLength(1)
  heading!: string;

  @IsOptional()
  @IsString()
  subheading?: string;

  @IsOptional()
  @IsString()
  offerText?: string;

  @IsOptional()
  @IsUrl(URL_OPTIONS)
  bannerImageUrl?: string;

  @IsOptional()
  @IsUrl(URL_OPTIONS)
  bannerVideoUrl?: string;

  @IsOptional()
  @IsString()
  ctaText?: string;

  @IsOptional()
  @IsString()
  ctaLink?: string;

  @IsDateString()
  startDate!: string;

  @IsDateString()
  endDate!: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  targetCategoryId?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  targetDesignIds?: string[];
}

export class UpdateAdvertisementDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  heading?: string;

  @IsOptional()
  @IsString()
  subheading?: string;

  @IsOptional()
  @IsString()
  offerText?: string;

  @IsOptional()
  @IsUrl(URL_OPTIONS)
  bannerImageUrl?: string;

  @IsOptional()
  @IsUrl(URL_OPTIONS)
  bannerVideoUrl?: string;

  @IsOptional()
  @IsString()
  ctaText?: string;

  @IsOptional()
  @IsString()
  ctaLink?: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  targetCategoryId?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  targetDesignIds?: string[];
}
