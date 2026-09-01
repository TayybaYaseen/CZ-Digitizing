import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import type { ApiResponse } from '@czd/shared-types';

function isEnvelope(data: unknown): data is ApiResponse<unknown> {
  return typeof data === 'object' && data !== null && 'data' in data;
}

// Wraps every controller return value in the spec's { data, meta? } envelope, unless the
// controller already returned one (e.g. a paginated list handler setting `meta`) or the
// response has no body (204 routes like logout return undefined).
@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, ApiResponse<T> | undefined> {
  intercept(context: ExecutionContext, next: CallHandler<T>): Observable<ApiResponse<T> | undefined> {
    return next.handle().pipe(
      map((data): ApiResponse<T> | undefined => {
        if (data === undefined) return undefined;
        return isEnvelope(data) ? (data as ApiResponse<T>) : { data };
      }),
    );
  }
}
