import { IsOptional, IsUrl } from 'class-validator';

// AC-3 — an empty/omitted field hides that platform's icon everywhere it would otherwise
// appear; a non-empty value must be a well-formed URL (spec §5 Error state).
export class UpdateSocialDto {
  @IsOptional()
  @IsUrl()
  facebookUrl?: string;

  @IsOptional()
  @IsUrl()
  instagramUrl?: string;

  @IsOptional()
  @IsUrl()
  linkedinUrl?: string;

  @IsOptional()
  @IsUrl()
  xTwitterUrl?: string;

  @IsOptional()
  @IsUrl()
  youtubeUrl?: string;
}
