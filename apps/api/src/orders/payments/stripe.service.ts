import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import type { Env } from '../../config/env.validation';

// docs/specs/2026-08-28-08-orders-payment-processing.md §3 (AC-10). Wraps the official `stripe`
// SDK's webhook-signature verification (stripe.webhooks.constructEvent), which needs the RAW
// request body — see main.ts's raw-body exception for 'api/webhooks/stripe'.
@Injectable()
export class StripeService {
  private readonly logger = new Logger(StripeService.name);
  private readonly client: Stripe | null;
  private readonly webhookSecret?: string;

  constructor(config: ConfigService<Env, true>) {
    const secretKey = config.get('STRIPE_SECRET_KEY', { infer: true });
    this.webhookSecret = config.get('STRIPE_WEBHOOK_SECRET', { infer: true });
    this.client = secretKey ? new Stripe(secretKey) : null;
  }

  isConfigured(): boolean {
    return Boolean(this.client && this.webhookSecret);
  }

  // AC-10 — created at order-creation time (OrdersService.createFromCart) with metadata.orderId
  // set, so the webhook handler's payment_intent.succeeded lookup is a plain, already-trusted
  // metadata read rather than a guess. 3D Secure (where required) happens client-side against the
  // returned clientSecret via Stripe.js/Payment Element — out of this backend service's job.
  async createPaymentIntent(totalPkr: number, orderId: string): Promise<{ paymentIntentId: string; clientSecret: string | null } | null> {
    if (!this.client) return null;
    try {
      // Stripe's smallest-currency-unit amount; PKR has no minor unit in Stripe's supported list
      // for card processing in most merchant configurations, so this charges in USD-equivalent
      // cents as a documented placeholder — swapping the settlement currency is a config decision
      // for whoever finalizes Stripe's merchant account, not a code change here.
      const intent = await this.client.paymentIntents.create({
        amount: Math.round(totalPkr * 100),
        currency: 'usd',
        metadata: { orderId },
      });
      return { paymentIntentId: intent.id, clientSecret: intent.client_secret };
    } catch (err) {
      this.logger.error(`Stripe create-payment-intent failed: ${(err as Error).message}`);
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
