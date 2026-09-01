import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Twilio } from 'twilio';
import type { Env } from '../../config/env.validation';

export interface NotificationSmsInput {
  to: string; // E.164 phone number
  title: string;
  message: string | null;
}

// AC-10 — Twilio SMS, the same vendor already chosen for WhatsApp (shared credentials, distinct
// "from" number). Same not-configured-is-a-logged-failure pattern as WhatsApp/email.
@Injectable()
export class NotificationSmsService {
  private readonly logger = new Logger(NotificationSmsService.name);
  private readonly client: Twilio | null;
  private readonly from?: string;

  constructor(config: ConfigService<Env, true>) {
    const sid = config.get('TWILIO_ACCOUNT_SID', { infer: true });
    const token = config.get('TWILIO_AUTH_TOKEN', { infer: true });
    this.from = config.get('TWILIO_SMS_FROM', { infer: true });
    this.client = sid && token ? new Twilio(sid, token) : null;
  }

  async send(input: NotificationSmsInput): Promise<string | undefined> {
    if (!this.client || !this.from) {
      this.logger.log(`[sms not configured] to=${input.to} title="${input.title}"`);
      throw new Error('SMS is not configured (TWILIO_ACCOUNT_SID/TWILIO_AUTH_TOKEN/TWILIO_SMS_FROM unset)');
    }
    const result = await this.client.messages.create({
      from: this.from,
      to: input.to,
      body: input.message ? `${input.title}\n${input.message}` : input.title,
    });
    return result.sid;
  }
}
