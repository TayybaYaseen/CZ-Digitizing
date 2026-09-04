import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

const MAX_PAGE_SIZE = 50;

export class TipQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_PAGE_SIZE)
  pageSize: number = MAX_PAGE_SIZE;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  language_code?: string;

  // AC-3 — Tips linked from a relevant FAQ entry.
  @IsOptional()
  @IsString()
  linkedFaqId?: string;
}
