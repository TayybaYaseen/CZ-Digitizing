import { IsEmail, IsString, MaxLength } from 'class-validator';

// AC-1 — WhatsApp number + contact email, the values every public location (footer, Contact
// page, purchased-file support icon, click-to-chat links) reads.
export class UpdateContactDto {
  @IsString()
  @MaxLength(32)
  whatsappNumber!: string;

  @IsEmail()
  contactEmail!: string;
}
