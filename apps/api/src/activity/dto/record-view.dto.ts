import { IsIn, IsOptional } from 'class-validator';

export class RecordViewDto {
  @IsOptional()
  @IsIn(['web', 'mobile'])
  source?: 'web' | 'mobile';
}
