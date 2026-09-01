import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class RegisterDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8, { message: 'password must be at least 8 characters' })
  @MaxLength(72) // bcrypt's own input limit
  password!: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  displayName?: string;
}
