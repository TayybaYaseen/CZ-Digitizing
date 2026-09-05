import { IsBoolean, IsIn, IsInt, IsOptional, IsString, IsUrl, Max, MaxLength, Min, MinLength } from 'class-validator';

const URL_OPTIONS = { require_tld: false };

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

export class UpdateTestimonialDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  customerName?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  country?: string;

  @IsOptional()
  @IsString()
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
  @IsString()
  @MinLength(1)
  feedback?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  serviceUsed?: string;

  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;
}

// AC-7 — customer-submitted review, tied to one of the customer's own completed orders.
export class SubmitTestimonialDto {
  @IsString()
  orderId!: string;

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
}

export class ModerateTestimonialDto {
  @IsIn(['approved', 'rejected'])
  decision!: 'approved' | 'rejected';
}
