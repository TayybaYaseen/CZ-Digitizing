import { IsEmail } from 'class-validator';

// Same (email, device-id cookie) lookup as VerifyNewDeviceDto, minus the code.
export class ResendDeviceCodeDto {
  @IsEmail()
  email!: string;
}
