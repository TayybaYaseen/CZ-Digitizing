import { IsOptional, IsString } from 'class-validator';

// AC-1 — Step 2 loads questions scoped to the selected service.
export class QuoteQuestionQueryDto {
  @IsOptional()
  @IsString()
  serviceId?: string;
}
