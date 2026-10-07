import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, IsUrl, Matches, Max, MaxLength, Min, MinLength, ValidateIf } from 'class-validator';
import {
  REVIEW_COUNTRY_MAX,
  REVIEW_DISPLAY_NAME_MAX,
  REVIEW_DISPLAY_NAME_MIN,
  REVIEW_FEEDBACK_MAX,
  REVIEW_FEEDBACK_MIN,
  REVIEW_SERVICE_USED_MAX,
  REVIEW_SERVICE_USED_MIN,
} from '../testimonials.constants';
import { cleanReviewLine, cleanReviewText } from '../review-text.util';

const URL_OPTIONS = { require_tld: false };
const ID_PATTERN = /^\d{1,18}$/;

// Applied before validation (ValidationPipe transform: true), so the limits below measure the text
// that is actually stored.
const cleanText = ({ value }: { value: unknown }) => (typeof value === 'string' ? cleanReviewText(value) : value);
const cleanLine = ({ value }: { value: unknown }) => (typeof value === 'string' ? cleanReviewLine(value) : value);
// Optional single-line field: blank → undefined, so it is stored as NULL / left unchanged.
const cleanOptionalLine = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') return value;
  const cleaned = cleanReviewLine(value);
  return cleaned === '' ? undefined : cleaned;
};
// Optional ID from a multipart form: '' means "not provided".
const optionalId = ({ value }: { value: unknown }) => (value === '' || value === null ? undefined : value);

// AC-4/AC-5 — Admin-curated testimonial. AC-5's no-fabrication rule is a content-governance/
// process control (spec §4), surfaced as a warning banner in the Admin UI, not enforced here.
export class CreateTestimonialDto {
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  customerName!: string;

  @IsString()
  @MinLength(1)
  country!: string;

  @IsOptional()
  @IsString()
  business?: string;

  @IsOptional()
  @IsUrl(URL_OPTIONS)
  photoUrl?: string;

  @IsInt()
  @Min(1)
  @Max(5)
  rating!: number;

  @IsString()
  @MinLength(1)
  feedback!: string;

  @IsString()
  @MinLength(1)
  serviceUsed!: string;

  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;
}

// A-026 §16/§19 — Admin edit of either source. Same maximum lengths as the customer form; minimums
// stay at 1 so older, shorter admin-curated testimonials remain editable.
export class UpdateTestimonialDto {
  @IsOptional()
  @Transform(cleanLine)
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  customerName?: string;

  // null or '' clears it (customer reviews may have no country).
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? cleanReviewLine(value) || null : value))
  @ValidateIf((_, v) => v !== null)
  @IsString()
  @MaxLength(REVIEW_COUNTRY_MAX)
  country?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  business?: string;

  @IsOptional()
  @IsUrl(URL_OPTIONS)
  photoUrl?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  rating?: number;

  @IsOptional()
  @Transform(cleanText)
  @IsString()
  @MinLength(1)
  @MaxLength(REVIEW_FEEDBACK_MAX)
  feedback?: string;

  @IsOptional()
  @Transform(cleanLine)
  @IsString()
  @MinLength(1)
  @MaxLength(REVIEW_SERVICE_USED_MAX)
  serviceUsed?: string;

  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;
}

// A-026 §7/§19 — customer review. Arrives as multipart/form-data (optional `image` file) or JSON, so
// numbers are coerced from strings. Status/publish fields are not part of this DTO; the global
// ValidationPipe (forbidNonWhitelisted) rejects a request that tries to send them.
export class SubmitTestimonialDto {
  // Optional since A-026: a review may be about "General experience". When given, it must be one
  // of the caller's own eligible orders (checked in the service). Mutually exclusive with customRequestId.
  @IsOptional()
  @Transform(optionalId)
  @Matches(ID_PATTERN)
  orderId?: string;

  @IsOptional()
  @Transform(optionalId)
  @Matches(ID_PATTERN)
  customRequestId?: string;

  // Optional on the wire for backwards compatibility with the pre-A-026 form; the service falls back
  // to the profile display name/username (never the email).
  @IsOptional()
  @Transform(cleanLine)
  @IsString()
  @MinLength(REVIEW_DISPLAY_NAME_MIN)
  @MaxLength(REVIEW_DISPLAY_NAME_MAX)
  customerName?: string;

  @IsOptional()
  @Transform(cleanOptionalLine)
  @IsString()
  @MaxLength(REVIEW_COUNTRY_MAX)
  country?: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  rating!: number;

  @Transform(cleanText)
  @IsString()
  @MinLength(REVIEW_FEEDBACK_MIN)
  @MaxLength(REVIEW_FEEDBACK_MAX)
  feedback!: string;

  @Transform(cleanLine)
  @IsString()
  @MinLength(REVIEW_SERVICE_USED_MIN)
  @MaxLength(REVIEW_SERVICE_USED_MAX)
  serviceUsed!: string;
}

export class ModerateTestimonialDto {
  @IsIn(['approved', 'rejected'])
  decision!: 'approved' | 'rejected';
}

// A-026 §10 — Hide (false) / Unhide (true), approved reviews only.
export class SetTestimonialVisibilityDto {
  @IsBoolean()
  isPublished!: boolean;
}
