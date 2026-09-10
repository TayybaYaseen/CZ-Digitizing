import { IsEmail, IsString, Length } from 'class-validator';

// Mirrors VerifyNewDeviceDto's shape (aspect A-023 — code-based email verification for
// apps/mobile, alongside the existing link-based flow apps/web uses).
export class VerifyEmailCodeDto {
  @IsEmail()
  email!: string;

  @IsString()
  @Length(4, 4)
  code!: string;
}
