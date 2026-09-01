import { Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, Max, Min } from 'class-validator';

// Spec §3 names `PagedResponse<NotificationDto>` for the list routes; the codebase's actual
// pagination convention is ApiResponse<T[]> + meta (packages/shared-types/src/api.ts) — this
// DTO just feeds that meta, no separate paging type introduced.
export class NotificationQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize: number = 20;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isRead?: boolean;
}
