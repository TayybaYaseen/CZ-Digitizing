import { IsEmail, IsString, Length } from 'class-validator';

// "code-bound" per spec §3 route table — the pending session is looked up by
// (email, device-id cookie), not a session id the client has to track.
export class VerifyNewDeviceDto {
  @IsEmail()
  email!: string;

  @IsString()
  @Length(4, 4)
  code!: string;
}
