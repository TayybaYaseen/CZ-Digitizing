import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class TaeboChatDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  message!: string;

  @IsOptional()
  @IsString()
  conversationId?: string;

  @IsString()
  @IsNotEmpty()
  sessionId!: string;

  @IsOptional()
  @IsString()
  page?: string;

  @IsOptional()
  @IsString()
  languageCode?: string;
}

export class TaeboAnswerDto {
  @IsString()
  @IsNotEmpty()
  answer!: string;
}
