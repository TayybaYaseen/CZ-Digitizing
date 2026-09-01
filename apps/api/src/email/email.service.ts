import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type { Env } from '../config/env.validation';

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
}

// SMTP-if-configured, else logs to the console — so local dev and CI work with zero email infra.
// A real provider (SES/SendGrid/etc.) can be swapped in later by pointing SMTP_* at it; nothing
// else in the auth module depends on the transport.
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly transport: nodemailer.Transporter | null;
  private readonly from: string;

  constructor(config: ConfigService<Env, true>) {
    this.from = config.get('EMAIL_FROM', { infer: true });
    const host = config.get('SMTP_HOST', { infer: true });
    this.transport = host
      ? nodemailer.createTransport({
          host,
          port: config.get('SMTP_PORT', { infer: true }) ?? 587,
          auth: { user: config.get('SMTP_USER', { infer: true }), pass: config.get('SMTP_PASS', { infer: true }) },
        })
      : null;
  }

  async send(message: EmailMessage): Promise<void> {
    if (!this.transport) {
      this.logger.log(`[dev email] to=${message.to} subject="${message.subject}"\n${message.text}`);
      return;
    }
    await this.transport.sendMail({ from: this.from, ...message });
  }
}
