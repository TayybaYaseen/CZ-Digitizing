import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsBoolean, IsInt, IsOptional, IsString, Min, MinLength, ValidateNested } from 'class-validator';

export class CreateHomeSectionDto {
  @IsString()
  @MinLength(1)
  heading!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;

  // AC-1 — the designs curated into this section, in display order.
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  designIds!: string[];
}

export class UpdateHomeSectionDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  heading?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  designIds?: string[];
}

class ReorderEntryDto {
  @IsString()
  id!: string;

  @IsInt()
  @Min(0)
  sortOrder!: number;
}

export class ReorderHomeSectionsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ReorderEntryDto)
  items!: ReorderEntryDto[];
}
