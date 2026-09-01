import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Twilio } from 'twilio';
import type { Env } from '../../config/env.validation';

export interface NotificationWhatsappInput {
  to: string; // E.164 phone number
  title: string;
  message: string | null;
}

// AC-6 — Twilio WhatsApp. SMTP_*-style optional config: unset credentials means "not configured",
// logged and reported as a failure to the caller (NotificationDispatchService) rather than thrown,
// so it never blocks sibling channels.
@Injectable()
export class NotificationWhatsappService {
  private readonly logger = new Logger(NotificationWhatsappService.name);
  private readonly client: Twilio | null;
  private readonly from?: string;

  constructor(config: ConfigService<Env, true>) {
    const sid = config.get('TWILIO_ACCOUNT_SID', { infer: true });
    const token = config.get('TWILIO_AUTH_TOKEN', { infer: true });
    this.from = config.get('TWILIO_WHATSAPP_FROM', { infer: true });
    this.client = sid && token ? new Twilio(sid, token) : null;
  }

  // Returns the provider message id on success. Throws on any failure — caller records it.
  async send(input: NotificationWhatsappInput): Promise<string | undefined> {
    if (!this.client || !this.from) {
      this.logger.log(`[whatsapp not configured] to=${input.to} title="${input.title}"`);
      throw new Error('WhatsApp is not configured (TWILIO_ACCOUNT_SID/TWILIO_AUTH_TOKEN/TWILIO_WHATSAPP_FROM unset)');
    }
    const result = await this.client.messages.create({
      from: `whatsapp:${this.from}`,
      to: `whatsapp:${input.to}`,
      body: input.message ? `${input.title}\n${input.message}` : input.title,
    });
    return result.sid;
  }
}
