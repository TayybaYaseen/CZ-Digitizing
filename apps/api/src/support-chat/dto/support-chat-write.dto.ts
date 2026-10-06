import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min, ValidateIf } from 'class-validator';
import type { SupportContextType, SupportConversationStatus } from '@czd/shared-types';
import {
  ADMIN_LIST_PAGE_SIZE_DEFAULT,
  ADMIN_LIST_PAGE_SIZE_MAX,
  CUSTOMER_LIST_PAGE_SIZE_DEFAULT,
  CUSTOMER_LIST_PAGE_SIZE_MAX,
  MESSAGE_PAGE_DEFAULT,
  MESSAGE_PAGE_MAX,
  SUPPORT_MESSAGE_MAX_LENGTH,
} from '../support-chat.constants';

const CONTEXT_TYPES: SupportContextType[] = ['general', 'order', 'custom_request', 'quote', 'file_format_request'];
const STATUSES: SupportConversationStatus[] = ['open', 'pending', 'resolved'];
const ID_PATTERN = /^\d{1,18}$/;

// Raw-length guard only — the real 1–4,000 rule runs after normalization in the service
// (normalizeSupportMessageBody), since stripping control characters/whitespace can change the length.
// The slack here lets a body with e.g. trailing whitespace still reach normalization.
const RAW_BODY_MAX = SUPPORT_MESSAGE_MAX_LENGTH * 2;

export class SendSupportMessageDto {
  @IsUUID('4')
  clientMessageId!: string;

  @IsString()
  @MaxLength(RAW_BODY_MAX)
  body!: string;
}

export class StartSupportConversationDto extends SendSupportMessageDto {
  @IsOptional()
  @IsIn(CONTEXT_TYPES)
  contextType: SupportContextType = 'general';

  @ValidateIf((o: StartSupportConversationDto) => o.contextType !== 'general' || o.contextId !== undefined)
  @IsString()
  @Matches(ID_PATTERN, { message: 'contextId must be a numeric id' })
  contextId?: string;
}

export class SupportReadDto {
  @IsString()
  @Matches(ID_PATTERN, { message: 'upToMessageId must be a numeric id' })
  upToMessageId!: string;
}

export class SupportMessagesQueryDto {
  @IsOptional()
  @Matches(ID_PATTERN, { message: 'before must be a numeric id' })
  before?: string;

  @IsOptional()
  @Matches(ID_PATTERN, { message: 'after must be a numeric id' })
  after?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MESSAGE_PAGE_MAX)
  limit: number = MESSAGE_PAGE_DEFAULT;
}

export class SupportCustomerListQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(CUSTOMER_LIST_PAGE_SIZE_MAX)
  pageSize: number = CUSTOMER_LIST_PAGE_SIZE_DEFAULT;
}

export class SupportAdminListQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(ADMIN_LIST_PAGE_SIZE_MAX)
  pageSize: number = ADMIN_LIST_PAGE_SIZE_DEFAULT;

  @IsOptional()
  @IsIn(STATUSES)
  status?: SupportConversationStatus;

  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true' || value === '1')
  @IsBoolean()
  unread?: boolean;

  @IsOptional()
  @IsIn(CONTEXT_TYPES)
  contextType?: SupportContextType;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MaxLength(100)
  q?: string;
}

export class UpdateSupportStatusDto {
  @IsIn(STATUSES)
  status!: SupportConversationStatus;
}
