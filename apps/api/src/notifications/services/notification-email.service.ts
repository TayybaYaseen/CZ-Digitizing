import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { NotificationType } from '../../generated/prisma';
import { SecretCipher } from '../../common/crypto/secret-cipher';
import type { Env } from '../../config/env.validation';
import { EmailService } from '../../email/email.service';
import { wrapBrandedHtml } from '../templates/branded-email.template';
import { ADMIN_ONLY_TYPES } from '../notifications.constants';

export interface NotificationEmailInput {
  to: string;
  userId: bigint;
  type: NotificationType;
  title: string;
  message: string | null;
}

// AC-5 — HTML branded template + unsubscribe link "where applicable". Delegates the actual
// transport to the existing global EmailService (SMTP-optional, no-op-to-console in dev) — never
// a second ad-hoc sender.
@Injectable()
export class NotificationEmailService {
  private readonly webBaseUrl: string;
  private readonly cipher: SecretCipher;

  constructor(
    private readonly email: EmailService,
    config: ConfigService<Env, true>,
  ) {
    this.webBaseUrl = config.get('WEB_BASE_URL', { infer: true });
    this.cipher = SecretCipher.fromBase64Key(config.get('APP_ENCRYPTION_KEY', { infer: true }));
  }

  async send(input: NotificationEmailInput): Promise<void> {
    // Admin-only alert types have no customer preference center entry to unsubscribe from.
    // Token is opaque (encrypted "userId:type"), not a guessable raw user id in the URL.
    const unsubscribeUrl = ADMIN_ONLY_TYPES.includes(input.type)
      ? undefined
      : `${this.webBaseUrl}/account/notifications/preferences?token=${encodeURIComponent(this.cipher.encrypt(`${input.userId}:${input.type}`))}`;

    await this.email.send({
      to: input.to,
      subject: input.title,
      text: input.message ?? input.title,
      html: wrapBrandedHtml({ title: input.title, message: input.message, unsubscribeUrl }),
    });
  }
}
