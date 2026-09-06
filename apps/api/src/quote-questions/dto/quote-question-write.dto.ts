import { IsBoolean, IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator';

export class CreateQuoteQuestionDto {
  @IsString()
  @MinLength(1)
  question!: string;

  @IsString()
  @MinLength(1)
  answer!: string;

  @IsString()
  serviceId!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;
}

export class UpdateQuoteQuestionDto {
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
  serviceId?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;
}
