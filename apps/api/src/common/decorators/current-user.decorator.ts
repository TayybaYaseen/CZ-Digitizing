import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { AccessTokenPayload } from '../../auth/token.types';

export interface AuthenticatedRequest extends Request {
  user: AccessTokenPayload;
}

export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext): AccessTokenPayload => {
  const req = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
  return req.user;
});
