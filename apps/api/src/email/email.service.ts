import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type { Env } from '../config/env.validation';
import { BrevoTransactionalClient } from './brevo-transactional.client';

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  // Optional HTML alternative (notifications-system.md AC-5's branded template) — nodemailer
  // sends a multipart message when both are present; plain-text callers are unaffected.
  html?: string;
  // 'admin' marks an email for the Admin site's staff (admin/moderator/freelancer). It is routed
  // through the Brevo Transactional API when BREVO_ADMIN_* is configured; otherwise it falls
  // through to the same transport as every other email. Unset = customer/default path.
  audience?: 'admin';
}

const BREVO_SMTP_HOST = 'smtp-relay.brevo.com';
const BREVO_SMTP_PORT = 587;

// Admin audience: Brevo Transactional API if BREVO_ADMIN_* is configured. Everything else: Brevo
// SMTP relay if BREVO_CUSTOMER_* is configured, else generic SMTP if configured, else logs to the
// console (dev/test only; production/staging throw instead) — so local dev and CI work with zero
// email infra. Nothing else in the auth module depends on the transport.
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly transport: nodemailer.Transporter | null;
  private readonly adminBrevo: BrevoTransactionalClient | null;
  private readonly from: string;
  private readonly requireTransport: boolean;
  private readonly secrets: string[];

  constructor(config: ConfigService<Env, true>) {
    this.from = config.get('EMAIL_FROM', { infer: true });
    this.requireTransport = ['production', 'staging'].includes(config.get('NODE_ENV', { infer: true }));
    this.secrets = [
      config.get('BREVO_CUSTOMER_API_KEY', { infer: true }),
      config.get('BREVO_CUSTOMER_SMTP_LOGIN', { infer: true }),
      config.get('SMTP_PASS', { infer: true }),
    ].filter((s): s is string => !!s);

    const adminKey = config.get('BREVO_ADMIN_API_KEY', { infer: true });
    const adminSenderEmail = config.get('BREVO_ADMIN_SENDER_EMAIL', { infer: true });
    if (adminKey && adminSenderEmail) {
      this.adminBrevo = new BrevoTransactionalClient(adminKey, {
        email: adminSenderEmail,
        name: config.get('BREVO_ADMIN_SENDER_NAME', { infer: true }) ?? 'CZ Digitizing',
      });
    } else {
      this.adminBrevo = null;
      if (adminKey) {
        this.logger.warn('BREVO_ADMIN_API_KEY is set but BREVO_ADMIN_SENDER_EMAIL is not — admin Brevo is NOT active');
      }
    }

    const brevoKey = config.get('BREVO_CUSTOMER_API_KEY', { infer: true });
    const brevoLogin = config.get('BREVO_CUSTOMER_SMTP_LOGIN', { infer: true });
    const host = config.get('SMTP_HOST', { infer: true });
    if (brevoKey && brevoLogin) {
      this.transport = nodemailer.createTransport({
        host: BREVO_SMTP_HOST,
        port: BREVO_SMTP_PORT,
        auth: { user: brevoLogin, pass: brevoKey },
      });
    } else {
      if (brevoKey) {
        this.logger.warn('BREVO_CUSTOMER_API_KEY is set but BREVO_CUSTOMER_SMTP_LOGIN is not — Brevo is NOT active');
      }
      this.transport = host
        ? nodemailer.createTransport({
            host,
            port: config.get('SMTP_PORT', { infer: true }) ?? 587,
            auth: { user: config.get('SMTP_USER', { infer: true }), pass: config.get('SMTP_PASS', { infer: true }) },
          })
        : null;
    }
  }

  async send({ audience, ...message }: EmailMessage): Promise<void> {
    // A Brevo failure throws (never silently falls back to another transport) so callers' own
    // retry/logging — e.g. NotificationDispatchService's email backoff — still see it.
    if (audience === 'admin' && this.adminBrevo) {
      await this.adminBrevo.send(message);
      return;
    }
    if (!this.transport) {
      // Never report success for an email that was not sent: production/staging fail loudly,
      // dev/test keeps the zero-infra console fallback but says plainly that nothing was delivered.
      if (this.requireTransport) {
        this.logger.error(`Email NOT sent to ${message.to} ("${message.subject}"): no mail transport is configured`);
        throw new Error('Email transport is not configured');
      }
      this.logger.warn(`[dev email] NOT SENT (no mail transport configured) to=${message.to} subject="${message.subject}"\n${message.text}`);
      return;
    }
    try {
      await this.transport.sendMail({ from: this.from, ...message });
    } catch (err) {
      this.logger.error(`Email to ${message.to} ("${message.subject}") failed via SMTP: ${this.describeError(err)}`);
      throw err;
    }
  }

  // Code + SMTP response only — never the raw error object, and any configured credential is masked.
  private describeError(err: unknown): string {
    const e = err as { code?: string; responseCode?: number; message?: string };
    let text = [e.code, e.responseCode, e.message].filter(Boolean).join(' ') || 'unknown error';
    for (const secret of this.secrets) text = text.split(secret).join('***');
    return text;
  }
}
