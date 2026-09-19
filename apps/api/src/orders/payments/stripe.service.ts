import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import type { Env } from '../../config/env.validation';

export interface CreatePaymentIntentInput {
  // Our own reference (the order id, or "credit:N"/"subscription:N") — stored as
  // metadata.orderId, which is what the webhook resolves the payment back to.
  referenceId: string;
  // Already converted by PaymentAmountService: a provider-supported currency and an integer amount
  // in that currency's smallest unit. This service never converts and never assumes PKR == USD.
  currency: string;
  amountMinor: number;
  // Stripe idempotency key: a retried create call returns the same PaymentIntent.
  idempotencyKey?: string;
}

// docs/specs/2026-08-28-08-orders-payment-processing.md §3 (AC-10). Wraps the official `stripe`
// SDK. Webhook-signature verification (stripe.webhooks.constructEvent) needs the RAW request body —
// see main.ts's raw-body exception for 'api/webhooks/stripe'.
@Injectable()
export class StripeService {
  private readonly logger = new Logger(StripeService.name);
  private readonly client: Stripe | null;
  private readonly webhookSecret?: string;
  private readonly publishable?: string;

  constructor(config: ConfigService<Env, true>) {
    const secretKey = config.get('STRIPE_SECRET_KEY', { infer: true });
    this.webhookSecret = config.get('STRIPE_WEBHOOK_SECRET', { infer: true });
    this.publishable = config.get('STRIPE_PUBLISHABLE_KEY', { infer: true });
    this.client = secretKey ? new Stripe(secretKey) : null;
  }

  isConfigured(): boolean {
    return Boolean(this.client && this.webhookSecret);
  }

  // Creating a PaymentIntent needs the secret key and the publishable key the browser mounts the
  // Payment Element with; the webhook secret is only for verifying inbound events.
  canCreatePayments(): boolean {
    return Boolean(this.client && this.publishable);
  }

  publishableKey(): string | null {
    return this.publishable ?? null;
  }

  // AC-10 — the PaymentIntent is created with metadata.orderId set, so the webhook's
  // payment_intent.succeeded lookup is a plain, already-trusted metadata read rather than a guess.
  // automatic_payment_methods lets Stripe's Payment Element offer cards and run 3-D Secure (SCA)
  // itself, client-side, against the returned clientSecret — out of this backend service's job.
  async createPaymentIntent(input: CreatePaymentIntentInput): Promise<{ paymentIntentId: string; clientSecret: string | null } | null> {
    if (!this.client) return null;
    try {
      const intent = await this.client.paymentIntents.create(
        {
          amount: input.amountMinor,
          currency: input.currency.toLowerCase(),
          automatic_payment_methods: { enabled: true },
          metadata: { orderId: input.referenceId },
        },
        input.idempotencyKey ? { idempotencyKey: input.idempotencyKey } : undefined,
      );
      return { paymentIntentId: intent.id, clientSecret: intent.client_secret };
    } catch (err) {
      this.logger.error(`Stripe create-payment-intent failed: ${(err as Error).message}`);
      return null;
    }
  }

  // Server-side read of the PaymentIntent's real state at Stripe.
  async retrievePaymentIntent(paymentIntentId: string): Promise<Stripe.PaymentIntent | null> {
    if (!this.client) return null;
    try {
      return await this.client.paymentIntents.retrieve(paymentIntentId);
    } catch (err) {
      this.logger.error(`Stripe retrieve-payment-intent ${paymentIntentId} failed: ${(err as Error).message}`);
      return null;
    }
  }

  // AC-2 (same posture as PayPal's) — returns null (never throws) on any verification failure,
  // including "not configured", so the webhook controller's reject-and-log path is uniform.
  verifyAndParseEvent(rawBody: Buffer, signatureHeader: string): Stripe.Event | null {
    if (!this.client || !this.webhookSecret) {
      this.logger.warn('Stripe webhook received but STRIPE_SECRET_KEY/STRIPE_WEBHOOK_SECRET are not configured');
      return null;
    }
    try {
      return this.client.webhooks.constructEvent(rawBody, signatureHeader, this.webhookSecret);
    } catch (err) {
      this.logger.error(`Stripe webhook signature verification failed: ${(err as Error).message}`);
      return null;
    }
  }
}
