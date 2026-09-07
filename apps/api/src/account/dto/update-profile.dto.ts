import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

// AC-3 — display name / avatar only. Never touches email/role/password (those are Auth's own
// routes) and never rewrites any historical order/quote/custom-request record — those keep the
// identity info captured at submission time by construction, since this DTO only updates the
// `users` row itself.
export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  displayName?: string;
}
