import { IsBoolean, IsOptional, IsString, IsUrl, Matches, MaxLength, MinLength } from 'class-validator';

const URL_OPTIONS = { require_tld: false };
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export class CreateBlogPostDto {
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  title!: string;

  @IsString()
  @Matches(SLUG_PATTERN, { message: 'slug must be lowercase, alphanumeric, hyphen-separated' })
  slug!: string;

  @IsOptional()
  @IsUrl(URL_OPTIONS)
  coverImageUrl?: string;

  @IsString()
  @MinLength(1)
  body!: string;

  @IsString()
  @MinLength(1)
  category!: string;

  @IsOptional()
  @IsString()
  languageCode?: string;

  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;
}

export class UpdateBlogPostDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  title?: string;

  @IsOptional()
  @IsString()
  @Matches(SLUG_PATTERN, { message: 'slug must be lowercase, alphanumeric, hyphen-separated' })
  slug?: string;

  @IsOptional()
  @IsUrl(URL_OPTIONS)
  coverImageUrl?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  body?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  category?: string;

  @IsOptional()
  @IsString()
  languageCode?: string;

  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;
}
