import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'crypto';
import type { Role } from '@czd/shared-types';
import { ApiException } from '../../common/exceptions/api-exception';
import type { Env } from '../../config/env.validation';
import {
  ACCESS_TOKEN_TTL_SECONDS,
  EMAIL_VERIFICATION_TTL_SECONDS,
  MAGIC_LINK_TTL_SECONDS,
  PENDING_2FA_TTL_SECONDS,
  REFRESH_TOKEN_TTL_SECONDS,
} from '../auth.constants';
import type {
  AccessTokenPayload,
  EmailVerificationTokenPayload,
  MagicLinkTokenPayload,
  PartialSessionTokenPayload,
  RefreshTokenPayload,
} from '../token.types';

// JWT structure fixed by CZ_DIGITIZING_ARCHITECTURE.md § Authentication & Security and the spec's
// §3 — "no changes proposed here". Access/refresh use distinct secrets so a leaked refresh
// signing key can't be used to mint access tokens and vice versa.
@Injectable()
export class TokenService {
  private readonly accessSecret: string;
  private readonly refreshSecret: string;

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService<Env, true>,
  ) {
    this.accessSecret = this.config.get('JWT_ACCESS_SECRET', { infer: true });
    this.refreshSecret = this.config.get('JWT_REFRESH_SECRET', { infer: true });
  }

  signAccessToken(input: { userId: bigint; email: string; role: Role; deviceId: string; permissions: string[] }): string {
    const payload: Omit<AccessTokenPayload, 'iat' | 'exp'> = {
      sub: input.userId.toString(),
      email: input.email,
      role: input.role,
      device_id: input.deviceId,
      permissions: input.permissions,
    };
    return this.jwt.sign(payload, { secret: this.accessSecret, expiresIn: ACCESS_TOKEN_TTL_SECONDS });
  }

  verifyAccessToken(token: string): AccessTokenPayload {
    return this.verify<AccessTokenPayload>(token, this.accessSecret);
  }

  signRefreshToken(input: { userId: bigint; sessionId: string }): string {
    const payload: Omit<RefreshTokenPayload, 'iat' | 'exp'> = { sub: input.userId.toString(), session_id: input.sessionId };
    return this.jwt.sign(payload, { secret: this.refreshSecret, expiresIn: REFRESH_TOKEN_TTL_SECONDS });
  }

  verifyRefreshToken(token: string): RefreshTokenPayload {
    return this.verify<RefreshTokenPayload>(token, this.refreshSecret);
  }

  signMagicLinkToken(input: { userId: bigint; email: string; deviceId: string }): string {
    const payload: Omit<MagicLinkTokenPayload, 'iat' | 'exp'> = {
      purpose: 'magic_link',
      sub: input.userId.toString(),
      email: input.email,
      device_id: input.deviceId,
      jti: randomUUID(),
    };
    return this.jwt.sign(payload, { secret: this.accessSecret, expiresIn: MAGIC_LINK_TTL_SECONDS });
  }

  verifyMagicLinkToken(token: string): MagicLinkTokenPayload {
    const payload = this.verify<MagicLinkTokenPayload>(token, this.accessSecret);
    if (payload.purpose !== 'magic_link') {
      throw new ApiException('INVALID_OR_EXPIRED_CODE', 401, 'Invalid or expired magic link');
    }
    return payload;
  }

  signPendingTwoFactorToken(input: { userId: bigint; deviceId: string }): string {
    const payload: Omit<PartialSessionTokenPayload, 'iat' | 'exp'> = {
      purpose: 'pending_2fa',
      sub: input.userId.toString(),
      device_id: input.deviceId,
    };
    return this.jwt.sign(payload, { secret: this.accessSecret, expiresIn: PENDING_2FA_TTL_SECONDS });
  }

  verifyPendingTwoFactorToken(token: string): PartialSessionTokenPayload {
    const payload = this.verify<PartialSessionTokenPayload>(token, this.accessSecret);
    if (payload.purpose !== 'pending_2fa') {
      throw new ApiException('UNAUTHENTICATED', 401, 'Invalid or expired 2FA session');
    }
    return payload;
  }

  signEmailVerificationToken(userId: bigint): string {
    const payload: Omit<EmailVerificationTokenPayload, 'iat' | 'exp'> = { purpose: 'verify_email', sub: userId.toString() };
    return this.jwt.sign(payload, { secret: this.accessSecret, expiresIn: EMAIL_VERIFICATION_TTL_SECONDS });
  }

  verifyEmailVerificationToken(token: string): EmailVerificationTokenPayload {
    const payload = this.verify<EmailVerificationTokenPayload>(token, this.accessSecret);
    if (payload.purpose !== 'verify_email') {
      throw new ApiException('INVALID_OR_EXPIRED_CODE', 401, 'Invalid or expired verification link');
    }
    return payload;
  }

  private verify<T extends object>(token: string, secret: string): T {
    try {
      return this.jwt.verify<T>(token, { secret });
    } catch {
      throw new ApiException('UNAUTHENTICATED', 401, 'Invalid or expired token');
    }
  }
}
