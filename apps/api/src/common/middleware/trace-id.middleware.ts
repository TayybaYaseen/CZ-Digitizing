import { Injectable, NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { NextFunction, Request, Response } from 'express';

export interface RequestWithTraceId extends Request {
  traceId: string;
}

@Injectable()
export class TraceIdMiddleware implements NestMiddleware {
  use(req: RequestWithTraceId, res: Response, next: NextFunction) {
    req.traceId = randomUUID();
    res.setHeader('X-Trace-Id', req.traceId);
    next();
  }
}
