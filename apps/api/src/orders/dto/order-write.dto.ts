import { Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';

const ORDER_STATUSES = ['pending', 'payment_pending', 'payment_confirmed', 'processing', 'ready', 'completed', 'cancelled', 'refunded'] as const;

// PUT /api/orders/:id/status — admin manual transitions (bank-transfer path per spec §3).
export class UpdateOrderStatusDto {
  @IsIn(ORDER_STATUSES)
  status!: (typeof ORDER_STATUSES)[number];
}

// POST /api/orders/:id/payment-confirmation — AC-5: Admin marks the most recent receipt
// Confirmed or Rejected/Pending. `approve: false` requires a reason so the customer sees a real
// explanation (spec §5 "bank-transfer rejection shows Admin's stated reason if provided").
export class PaymentConfirmationDto {
  @IsBoolean()
  approve!: boolean;

  @IsOptional()
  @IsString()
  rejectionReason?: string;
}

// PUT /api/orders/:id/refund — AC-11 extension of the status-update endpoint's admin surface.
// amountPkr omitted => full refund of the order's totalPkr.
export class RefundOrderDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  amountPkr?: number;

  @IsOptional()
  @IsString()
  reason?: string;
}

// GET /api/orders — admin filterable list.
export class OrderQueryDto {
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
  @IsIn(ORDER_STATUSES)
  status?: (typeof ORDER_STATUSES)[number];

  @IsOptional()
  @IsString()
  customerId?: string;

  @IsOptional()
  @IsString()
  fromDate?: string;

  @IsOptional()
  @IsString()
  toDate?: string;
}

// Shared by GET /api/orders/:id and GET /api/orders/user/history — AC-8's currency display.
export class CurrencyQueryDto {
  @IsOptional()
  @IsString()
  currencyCode?: string;
}
