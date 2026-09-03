import { Transform, Type } from 'class-transformer';
import { IsArray, IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

const MAX_PAGE_SIZE = 50; // architecture §Search Optimization pagination limit (AC-7)

// ?category=1,2 arrives as the string "1,2" over HTTP — split it into an array before validation.
function splitCsv({ value }: { value: unknown }): unknown {
  if (typeof value !== 'string') return value;
  return value.split(',').filter(Boolean);
}

// AC-7 — All Designs faceted filters. category/tags accept comma-separated ids/strings from the
// query string (?category=1,2&tags=floral,caps).
export class DesignQueryDto {
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
  @Transform(splitCsv)
  @IsArray()
  @IsString({ each: true })
  category?: string[];

  @IsOptional()
  @IsString()
  subcategoryId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  minPricePkr?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  maxPricePkr?: number;

  @IsOptional()
  @Transform(splitCsv)
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  minStitchCount?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  maxStitchCount?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  threadColorCount?: number;

  @IsOptional()
  @IsIn(['newest', 'price_asc', 'price_desc'])
  sort?: 'newest' | 'price_asc' | 'price_desc';
}
