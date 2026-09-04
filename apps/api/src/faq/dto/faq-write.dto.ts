import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator';

export class CreateFaqDto {
  @IsString()
  @MinLength(1)
  question!: string;

  @IsString()
  @MinLength(1)
  answer!: string;

  @IsString()
  @MinLength(1)
  topic!: string;

  @IsOptional()
  @IsString()
  relatedPage?: string;

  @IsOptional()
  @IsString()
  relatedService?: string;

  @IsOptional()
  @IsString()
  relatedCategory?: string;

  @IsOptional()
  @IsString()
  languageCode?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  priority?: number;

  @IsOptional()
  @IsBoolean()
  taeboVisible?: boolean;

  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;
}

export class UpdateFaqDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  question?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  answer?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  topic?: string;

  @IsOptional()
  @IsString()
  relatedPage?: string;

  @IsOptional()
  @IsString()
  relatedService?: string;

  @IsOptional()
  @IsString()
  relatedCategory?: string;

  @IsOptional()
  @IsString()
  languageCode?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  priority?: number;

  @IsOptional()
  @IsBoolean()
  taeboVisible?: boolean;

  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;
}

// AC-8 — "Was this helpful?" Yes/No.
export class FaqFeedbackDto {
  @IsIn(['yes', 'no'])
  vote!: 'yes' | 'no';
}
