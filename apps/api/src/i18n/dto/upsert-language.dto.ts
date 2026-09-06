import { IsBoolean, IsInt, IsString, Min, MinLength } from 'class-validator';

export class UpsertLanguageDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsString()
  @MinLength(1)
  nativeName!: string;

  @IsBoolean()
  isRtl!: boolean;

  @IsBoolean()
  isEnabled!: boolean;

  @IsInt()
  @Min(0)
  sortOrder!: number;
}
