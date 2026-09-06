import { IsOptional, IsString, MinLength } from 'class-validator';

// POST /api/orders/:orderId/file-format-request — AC-6.
export class CreateFileFormatRequestDto {
  @IsString()
  @MinLength(1)
  requestedFormat!: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

// POST /api/file-format-requests/:id/fulfill — Admin picks (or uploads a new) DesignFile in the
// requested format for the order's design; designId disambiguates a multi-item order.
export class FulfillFileFormatRequestDto {
  @IsOptional()
  @IsString()
  designId?: string;
}
