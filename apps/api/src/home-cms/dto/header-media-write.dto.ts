import { IsBoolean, IsDateString, IsIn, IsInt, IsOptional, IsString, IsUrl, Max, Min } from 'class-validator';

const URL_OPTIONS = { require_tld: false };

export class CreateHeaderMediaDto {
  @IsOptional()
  @IsUrl(URL_OPTIONS)
  imageUrl?: string;

  @IsOptional()
  @IsUrl(URL_OPTIONS)
  videoUrl?: string;

  @IsOptional()
  @IsString()
  heading?: string;

  @IsOptional()
  @IsString()
  subheading?: string;

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
  @IsInt()
  @Min(0)
  priority?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsBoolean()
  isCarouselItem?: boolean;

  @IsOptional()
  @IsBoolean()
  visibleDesktop?: boolean;

  @IsOptional()
  @IsBoolean()
  visibleMobileWeb?: boolean;

  @IsOptional()
  @IsBoolean()
  visibleMobileApp?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(60)
  autoSlideDurationSeconds?: number;
}

export class UpdateHeaderMediaDto extends CreateHeaderMediaDto {}

// AC-10 — per-platform visibility, resolved server-side from a caller-declared platform.
export class HeaderMediaQueryDto {
  @IsOptional()
  @IsIn(['desktop', 'mobile_web', 'mobile_app'])
  platform?: 'desktop' | 'mobile_web' | 'mobile_app';
}
