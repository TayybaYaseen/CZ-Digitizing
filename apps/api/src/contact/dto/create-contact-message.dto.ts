import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

// SRS §15 (Contact Us, aspect A-010) — "Contact form with name, email and message."
export class CreateContactMessageDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  message!: string;
}
