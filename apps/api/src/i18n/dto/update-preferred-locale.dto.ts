import { IsString, MinLength } from 'class-validator';

export class UpdatePreferredLocaleDto {
  @IsString()
  @MinLength(2)
  locale!: string;
}
