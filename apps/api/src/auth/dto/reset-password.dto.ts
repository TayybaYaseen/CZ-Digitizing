import { IsEmail, IsString, Length, MaxLength, MinLength } from 'class-validator';

export class ResetPasswordDto {
  @IsEmail()
  email!: string;

  @IsString()
  @Length(4, 4)
  code!: string;

  @IsString()
  @MinLength(8, { message: 'newPassword must be at least 8 characters' })
  @MaxLength(72)
  newPassword!: string;
}
