import { IsString, Matches, MaxLength } from 'class-validator';

// AC-11 — used everywhere the domain is referenced (canonical URLs, email templates, share
// links) without a code deploy. Bare hostname, no scheme/path (e.g. "czdigitizing.com").
export class UpdateDomainDto {
  @IsString()
  @MaxLength(255)
  @Matches(/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/i, {
    message: 'domain must be a bare hostname, e.g. czdigitizing.com',
  })
  domain!: string;
}
