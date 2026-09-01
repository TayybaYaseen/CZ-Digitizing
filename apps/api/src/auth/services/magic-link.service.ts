import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../../config/env.validation';
import { EmailService } from '../../email/email.service';
import { TokenService } from './token.service';

// AC-12 — issuing/verifying only. Session creation applies the same device-trust branching as a
// password login (AC-2/AC-3), so that part lives in AuthService alongside the login flow it
// mirrors, not here.
@Injectable()
export class MagicLinkService {
  private readonly webBaseUrl: string;

  constructor(
    private readonly tokens: TokenService,
    private readonly email: EmailService,
    config: ConfigService<Env, true>,
  ) {
    this.webBaseUrl = config.get('WEB_BASE_URL', { infer: true });
  }

  async sendLoginLink(input: { userId: bigint; email: string; deviceId: string }): Promise<void> {
    const token = this.tokens.signMagicLinkToken({ userId: input.userId, deviceId: input.deviceId });
    const link = `${this.webBaseUrl}/magic-link?token=${encodeURIComponent(token)}`;
    await this.email.send({
      to: input.email,
      subject: 'Your CZ Digitizing login link',
      text: `Click to log in (expires shortly): ${link}`,
    });
  }
}
