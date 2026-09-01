import { HttpException } from '@nestjs/common';
import type { ApiErrorCode } from '@czd/shared-types';

export interface ApiExceptionBody {
  code: ApiErrorCode;
  message: string;
  errors?: { field: string; message: string }[];
}

// Thrown by services to produce a spec-defined ApiError envelope (packages/shared-types/src/api.ts)
// via AllExceptionsFilter, instead of a bare NestJS HttpException.
export class ApiException extends HttpException {
  constructor(
    public readonly code: ApiErrorCode,
    status: number,
    message: string,
    public readonly errors?: { field: string; message: string }[],
  ) {
    super({ code, message, errors } satisfies ApiExceptionBody, status);
  }
}
