import { IsIn, IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator';

// AC-9 foundation — a draft only needs the service the customer picked in Step 1.
export class CreateQuoteDraftDto {
  @IsString()
  serviceId!: string;
}

// PATCH while the customer fills in Step 3 — every field optional, all validated together at
// submit time (SubmitQuoteDto below carries the real "required for real" set).
export class UpdateQuoteDraftDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  whatsapp?: string;

  @IsOptional()
  @IsString()
  country?: string;

  @IsOptional()
  @IsString()
  size?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  quantity?: number;

  @IsOptional()
  @IsString()
  fabric?: string;

  @IsOptional()
  @IsString()
  threadColors?: string;

  @IsOptional()
  @IsString()
  formatPreference?: string;

  @IsOptional()
  @IsString()
  deadline?: string;

  @IsOptional()
  @IsString()
  instructions?: string;
}

// AC-9 — one chat message, either side.
export class CreateQuoteMessageDto {
  @IsString()
  @MinLength(1)
  body!: string;
}

// AC-6 — Admin's response.
export class RespondQuoteDto {
  @IsString()
  quotedPricePkr!: string;

  @IsOptional()
  @IsString()
  adminNotes?: string;
}

// AC-7 — Admin converts a responded quote into an order.
export class ConvertQuoteDto {
  @IsIn(['bank_transfer', 'paypal', 'stripe'])
  paymentMethod!: 'bank_transfer' | 'paypal' | 'stripe';
}

// AC-1/AC-4 admin list filter.
export class QuoteQueryDto {
  @IsOptional()
  @IsIn(['draft', 'new', 'responded', 'converted_to_order'])
  status?: 'draft' | 'new' | 'responded' | 'converted_to_order';
}
