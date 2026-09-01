import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { Response } from 'express';
import type { ApiError } from '@czd/shared-types';
import { ApiException } from '../exceptions/api-exception';
import type { RequestWithTraceId } from '../middleware/trace-id.middleware';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<RequestWithTraceId>();
    const traceId = req.traceId ?? randomUUID();

    const { status, body } = this.resolve(exception);
    const error: ApiError = { ...body, traceId };

    if (status >= 500) {
      this.logger.error(`[${traceId}] ${this.describe(exception)}`, (exception as Error)?.stack);
    }

    res.status(status).json({ error } satisfies { error: ApiError });
  }

  private resolve(exception: unknown): { status: number; body: Omit<ApiError, 'traceId'> } {
    if (exception instanceof ApiException) {
      const response = exception.getResponse() as { code: ApiError['code']; message: string; errors?: ApiError['errors'] };
      return {
        status: exception.getStatus(),
        body: { code: response.code, message: response.message, errors: response.errors },
      };
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const response = exception.getResponse();

      // class-validator failures arrive here as a NestJS BadRequestException with
      // response.message: string[] — map them into the spec's VALIDATION_ERROR shape.
      if (status === HttpStatus.BAD_REQUEST && typeof response === 'object' && response !== null && Array.isArray((response as { message?: unknown }).message)) {
        const messages = (response as { message: string[] }).message;
        return {
          status,
          body: {
            code: 'VALIDATION_ERROR',
            message: 'Validation failed',
            errors: messages.map((message) => ({ field: this.fieldFromMessage(message), message })),
          },
        };
      }

      const message = typeof response === 'string' ? response : ((response as { message?: string }).message ?? exception.message);
      return { status, body: { code: this.codeForStatus(status), message } };
    }

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      body: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
    };
  }

  private fieldFromMessage(message: string): string {
    // forbidNonWhitelisted violations read "property <field> should not exist" — the field name
    // is the second word there, unlike every other class-validator message ("<field> must be...").
    const forbidNonWhitelisted = /^property (\S+) should not exist$/.exec(message);
    if (forbidNonWhitelisted) return forbidNonWhitelisted[1];
    return message.split(' ')[0] ?? 'unknown';
  }

  private codeForStatus(status: number): ApiError['code'] {
    switch (status) {
      case HttpStatus.UNAUTHORIZED:
        return 'UNAUTHENTICATED';
      case HttpStatus.FORBIDDEN:
        return 'FORBIDDEN';
      case HttpStatus.NOT_FOUND:
        return 'RESOURCE_NOT_FOUND';
      case HttpStatus.CONFLICT:
        return 'CONFLICT';
      case HttpStatus.TOO_MANY_REQUESTS:
        return 'RATE_LIMITED';
      default:
        return 'INTERNAL_ERROR';
    }
  }

  private describe(exception: unknown): string {
    return exception instanceof Error ? exception.message : String(exception);
  }
}
