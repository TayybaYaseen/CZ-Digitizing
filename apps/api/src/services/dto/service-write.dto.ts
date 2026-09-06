import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator';

const SERVICE_TYPES = ['embroidery_digitizing', 'vector_art'] as const;

export class CreateServiceDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsString()
  @MinLength(1)
  slug!: string;

  @IsIn(SERVICE_TYPES)
  type!: (typeof SERVICE_TYPES)[number];

  @IsOptional()
  @IsString()
  parentServiceId?: string;

  @IsString()
  @MinLength(1)
  description!: string;

  @IsString()
  @MinLength(1)
  visualImageUrl!: string;

  @IsString()
  @MinLength(1)
  applications!: string;

  @IsString()
  @MinLength(1)
  process!: string;

  @IsOptional()
  @IsString()
  relatedDesignCategoryId?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;
}

export class UpdateServiceDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  slug?: string;

  @IsOptional()
  @IsIn(SERVICE_TYPES)
  type?: (typeof SERVICE_TYPES)[number];

  @IsOptional()
  @IsString()
  parentServiceId?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  description?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  visualImageUrl?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  applications?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  process?: string;

  @IsOptional()
  @IsString()
  relatedDesignCategoryId?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;
}

// AC-8 reorder — sort_order update only.
export class ReorderServiceDto {
  @IsInt()
  @Min(0)
  sortOrder!: number;
}
