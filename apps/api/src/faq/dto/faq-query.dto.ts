import { IsOptional, IsString } from 'class-validator';

// AC-1/AC-2 — filterable by topic/language_code.
export class FaqQueryDto {
  @IsOptional()
  @IsString()
  topic?: string;

  @IsOptional()
  @IsString()
  language_code?: string;
}
