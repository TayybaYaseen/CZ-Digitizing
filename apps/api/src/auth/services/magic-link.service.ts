import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../../config/env.validation';
import { EmailService } from '../../email/email.service';
import { RedisService } from '../../redis/redis.service';
import { MAGIC_LINK_TTL_SECONDS } from '../auth.constants';
import { TokenService } from './token.service';

const REDIS_KEY_PREFIX = 'magic-link:used:';

// AC-12 — issuing/verifying only. Session creation applies the same device-trust branching as a
// password login (AC-2/AC-3), so that part lives in AuthService alongside the login flow it
// mirrors, not here.
@Injectable()
export class MagicLinkService {
  private readonly webBaseUrl: string;

  constructor(
    private readonly tokens: TokenService,
    private readonly email: EmailService,
    private readonly redis: RedisService,
    config: ConfigService<Env, true>,
  ) {
    this.webBaseUrl = config.get('WEB_BASE_URL', { infer: true });
  }

  async sendLoginLink(input: { userId: bigint; email: string; deviceId: string }): Promise<void> {
    const token = this.tokens.signMagicLinkToken({ userId: input.userId, email: input.email, deviceId: input.deviceId });
    const link = `${this.webBaseUrl}/magic-link?token=${encodeURIComponent(token)}`;
    await this.email.send({
      to: input.email,
      subject: 'Your CZ Digitizing login link',
      text: `Click to log in (expires shortly): ${link}`,
    });
  }

  // "Single-use" per the token.types.ts contract — a signature-valid, unexpired JWT is otherwise
  // replayable indefinitely within its window, which a magic link (sent over email, easily
  // forwarded/cached/re-clicked) must not be. `SET ... NX` atomically claims the jti; a second
  // claim on the same jti fails, meaning the link was already used.
  async claimSingleUse(jti: string): Promise<boolean> {
    const result = await this.redis.client.set(`${REDIS_KEY_PREFIX}${jti}`, '1', 'EX', MAGIC_LINK_TTL_SECONDS, 'NX');
    return result === 'OK';
  }
}
