import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { TokenService } from '../../auth/services/token.service';
import { ApiException } from '../exceptions/api-exception';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import type { AuthenticatedRequest } from '../decorators/current-user.decorator';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tokens: TokenService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const req = context.switchToHttp().getRequest<Request>();
    const token = this.extractBearerToken(req);

    if (isPublic) {
      // Opportunistic: a public route with a valid bearer token still gets req.user populated
      // (e.g. AC-8's isFavorited on a design, or an admin seeing unpublished categories) — an
      // invalid/expired token on a public route is silently treated as anonymous, not a 401.
      if (token) {
        try {
          (req as AuthenticatedRequest).user = this.tokens.verifyAccessToken(token);
        } catch {
          // anonymous
        }
      }
      return true;
    }

    if (!token) throw new ApiException('UNAUTHENTICATED', 401, 'Missing access token');

    (req as AuthenticatedRequest).user = this.tokens.verifyAccessToken(token);
    return true;
  }

  private extractBearerToken(req: Request): string | null {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) return null;
    return header.slice('Bearer '.length);
  }
}
