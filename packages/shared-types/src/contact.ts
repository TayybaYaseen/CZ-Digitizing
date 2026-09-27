// SRS §15 (Contact Us, aspect A-010) — submissions from the public contact form, as listed in Admin.

export interface ContactMessageDto {
  id: string;
  name: string;
  email: string;
  message: string;
  createdAt: string;
}
