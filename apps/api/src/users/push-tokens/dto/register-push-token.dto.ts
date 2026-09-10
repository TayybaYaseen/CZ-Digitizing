import { IsEnum, IsString, MinLength } from 'class-validator';
import { PushPlatform } from '../../../generated/prisma';

// docs/specs/2026-08-29-18-mobile-app-android-ios.md §3 — POST /api/users/push-token.
export class RegisterPushTokenDto {
  @IsString()
  @MinLength(8)
  token!: string;

  @IsEnum(PushPlatform)
  platform!: PushPlatform;
}
