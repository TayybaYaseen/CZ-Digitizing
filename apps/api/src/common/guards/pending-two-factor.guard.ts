import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { TokenService } from '../../auth/services/token.service';
import type { PartialSessionTokenPayload } from '../../auth/token.types';
import { ApiException } from '../exceptions/api-exception';

export interface PendingTwoFactorRequest extends Request {
  pendingTwoFactor: PartialSessionTokenPayload;
}

// Auth for /api/auth/2fa/setup|confirm and /verify-2fa — spec §3 calls this "Partial session
// (post-credentials)": the caller has proven their password (and, for setup/confirm, is
// mid-enrollment) but does not yet hold a full access token (AC-5).
@Injectable()
export class PendingTwoFactorGuard implements CanActivate {
  constructor(private readonly tokens: TokenService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<PendingTwoFactorRequest>();
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      throw new ApiException('UNAUTHENTICATED', 401, 'Missing pending 2FA session token');
    }
    req.pendingTwoFactor = this.tokens.verifyPendingTwoFactorToken(header.slice('Bearer '.length));
    return true;
  }
}
