import { IsArray, IsBoolean, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateTipDto {
  @IsString()
  @MinLength(1)
  title!: string;

  @IsString()
  @MinLength(1)
  content!: string;

  @IsString()
  @MinLength(1)
  category!: string;

  @IsOptional()
  @IsString()
  languageCode?: string;

  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;

  // AC-3 / SRS Addendum §8 — FAQ entries this Tip links to.
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  faqIds?: string[];
}

export class UpdateTipDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  title?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  content?: string;

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

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  faqIds?: string[];
}
