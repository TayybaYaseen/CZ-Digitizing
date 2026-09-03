import { IsBoolean, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import type { AllowedFileFormat } from '../../generated/prisma';

export interface AllowedFileFormatDto {
  id: string;
  extension: string;
  displayName: string;
  isPrivate: boolean;
  isLocked: boolean;
  isActive: boolean;
  maxFileSizeMb: number;
}

export function toAllowedFileFormatDto(row: AllowedFileFormat): AllowedFileFormatDto {
  return {
    id: row.id.toString(),
    extension: row.extension,
    displayName: row.displayName,
    isPrivate: row.isPrivate,
    isLocked: row.isLocked,
    isActive: row.isActive,
    maxFileSizeMb: row.maxFileSizeMb,
  };
}

// AC-13 — Admin adds a new machine-format extension without a code deploy.
export class CreateAllowedFileFormatDto {
  @IsString()
  @MaxLength(20)
  extension!: string;

  @IsString()
  @MaxLength(255)
  displayName!: string;

  @IsOptional()
  @IsBoolean()
  isPrivate?: boolean;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(250)
  maxFileSizeMb?: number;
}

// AC-14 — isLocked is deliberately absent from this DTO: a locked row's isPrivate/isLocked can
// never be set by any Admin action through this API, not even accidentally by omission-then-
// default. The service rejects any attempt regardless of what a client sends here.
export class UpdateAllowedFileFormatDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  displayName?: string;

  @IsOptional()
  @IsBoolean()
  isPrivate?: boolean;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(250)
  maxFileSizeMb?: number;
}
