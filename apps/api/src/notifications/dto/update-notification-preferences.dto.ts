import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsBoolean, IsEnum, ValidateNested } from 'class-validator';
import { NotificationChannel, NotificationType } from '../../generated/prisma';

class NotificationPreferenceEntryDto {
  @IsEnum(NotificationType)
  notificationType!: NotificationType;

  @IsEnum(NotificationChannel)
  channel!: NotificationChannel;

  @IsBoolean()
  enabled!: boolean;
}

// AC-9 — customer opts a (type, channel) pair in/out; absence of a row elsewhere means
// default-enabled, this DTO only ever carries explicit entries.
export class UpdateNotificationPreferencesDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => NotificationPreferenceEntryDto)
  preferences!: NotificationPreferenceEntryDto[];
}
