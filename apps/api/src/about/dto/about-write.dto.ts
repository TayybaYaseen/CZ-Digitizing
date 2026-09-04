import { IsArray, IsOptional, IsString, IsUrl, MinLength } from 'class-validator';

const URL_OPTIONS = { require_tld: false };

// AC-11 — upsert by languageCode, no publish step.
export class UpsertAboutContentDto {
  @IsString()
  languageCode!: string;

  @IsString()
  @MinLength(1)
  heading!: string;

  @IsString()
  @MinLength(1)
  body!: string;

  @IsOptional()
  @IsArray()
  @IsUrl(URL_OPTIONS, { each: true })
  imageUrls?: string[];
}
