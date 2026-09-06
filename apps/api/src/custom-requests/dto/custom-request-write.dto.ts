import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator';

const REQUEST_TYPES = ['embroidery_custom', 'vector_custom'] as const;
const STATUSES = [
  'new',
  'reviewing',
  'quote_sent',
  'approved',
  'in_production',
  'ready',
  'delivered',
  'completed',
  'need_more_info',
  'revision_required',
  'cancelled',
] as const;

// AC-1 — minimum required fields: image/logo (the multipart file), size, machine format. Fabric
// is optional. customer_id is NOT NULL in the architecture DDL (unlike Quote's guest posture), so
// this route requires an authenticated customer — see CustomRequestsController's own comment.
export class CreateCustomRequestDto {
  @IsIn(REQUEST_TYPES)
  requestType!: (typeof REQUEST_TYPES)[number];

  @IsOptional()
  @IsString()
  sizeValue?: string;

  @IsString()
  @MinLength(1)
  machineFormat!: string;

  @IsOptional()
  @IsString()
  fabricType?: string;

  @IsOptional()
  @IsString()
  specialInstructions?: string;
}

// PUT /api/custom-requests/:id — admin status/assignment/notes changes (AC-2/AC-3/AC-7).
export class UpdateCustomRequestDto {
  @IsOptional()
  @IsIn(STATUSES)
  status?: (typeof STATUSES)[number];

  @IsOptional()
  @IsString()
  designerId?: string;

  @IsOptional()
  @IsString()
  adminNotes?: string;
}

// POST /api/custom-requests/:id/quote — AC-4.
export class SendQuoteDto {
  @IsString()
  quotedPricePkr!: string;

  @IsOptional()
  @IsString()
  adminNotes?: string;
}

// POST /api/custom-requests/:id/approve — customer accepts the quote, AC-4.
export class ApproveQuoteDto {
  @IsIn(['bank_transfer', 'paypal', 'stripe'])
  paymentMethod!: 'bank_transfer' | 'paypal' | 'stripe';
}

// AC-8 — one chat message on the custom-request thread.
export class CreateCustomRequestMessageDto {
  @IsString()
  @MinLength(1)
  message!: string;
}

// GET /api/custom-requests — admin filterable list.
export class CustomRequestQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pageSize: number = 20;

  @IsOptional()
  @IsIn(STATUSES)
  status?: (typeof STATUSES)[number];
}
