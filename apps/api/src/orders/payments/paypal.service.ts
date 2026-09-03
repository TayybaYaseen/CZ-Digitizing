import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../../config/env.validation';

export interface PayPalWebhookHeaders {
  transmissionId: string;
  transmissionTime: string;
  certUrl: string;
  authAlgo: string;
  transmissionSig: string;
}

// docs/specs/2026-08-28-08-orders-payment-processing.md §3 (AC-1/AC-2). No @paypal/checkout-server-sdk
// dependency added — this repo has no existing HTTP client dependency (no axios anywhere in
// apps/api/package.json) and PayPal's REST API is a handful of plain JSON calls, so this uses
// Node's built-in global `fetch` (available since Node 18, this repo runs Node 20+ per
// apps/api's engines/CI image) rather than pulling in a whole SDK or a new HTTP-client dependency
// for two endpoints.
@Injectable()
export class PayPalService {
  private readonly logger = new Logger(PayPalService.name);
  private readonly clientId?: string;
  private readonly clientSecret?: string;
  private readonly webhookId?: string;
  private readonly apiBase: string;

  constructor(config: ConfigService<Env, true>) {
    this.clientId = config.get('PAYPAL_CLIENT_ID', { infer: true });
    this.clientSecret = config.get('PAYPAL_CLIENT_SECRET', { infer: true });
    this.webhookId = config.get('PAYPAL_WEBHOOK_ID', { infer: true });
    this.apiBase = config.get('PAYPAL_API_BASE', { infer: true });
  }

  isConfigured(): boolean {
    return Boolean(this.clientId && this.clientSecret && this.webhookId);
  }

  // AC-1 — called by OrdersService.createFromCart() when paymentMethod is 'paypal', so the
  // resulting orders.paypal_order_id is on file BEFORE the customer ever reaches PayPal's approval
  // flow — the webhook handler then only ever needs to look up an order by a reference it already
  // wrote itself, never trust an id echoed back unverified by the provider. Returns null when
  // unconfigured (dev without PayPal credentials) so checkout still creates a real order —
  // OrdersController's caller falls back to a manual/"contact support" path in that case.
  async createOrder(totalPkr: number, orderId: string): Promise<{ paypalOrderId: string; approveUrl: string | null } | null> {
    if (!this.isConfigured()) return null;
    try {
      const accessToken = await this.getAccessToken();
      const response = await fetch(`${this.apiBase}/v2/checkout/orders`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          intent: 'CAPTURE',
          purchase_units: [{ reference_id: orderId, amount: { currency_code: 'USD', value: totalPkr.toFixed(2) } }],
        }),
      });
      if (!response.ok) throw new Error(`PayPal create-order failed: ${response.status}`);
      const body = (await response.json()) as { id: string; links: { rel: string; href: string }[] };
      const approveUrl = body.links.find((l) => l.rel === 'approve')?.href ?? null;
      return { paypalOrderId: body.id, approveUrl };
    } catch (err) {
      this.logger.error(`PayPal create-order failed: ${(err as Error).message}`);
      return null;
    }
  }

  private async getAccessToken(): Promise<string> {
    const basicAuth = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');
    const response = await fetch(`${this.apiBase}/v1/oauth2/token`, {
      method: 'POST',
      headers: { Authorization: `Basic ${basicAuth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'grant_type=client_credentials',
    });
    if (!response.ok) throw new Error(`PayPal OAuth token request failed: ${response.status}`);
    const body = (await response.json()) as { access_token: string };
    return body.access_token;
  }

  // AC-2 — the standard, correct approach per PayPal's docs: POST the transmission headers + raw
  // event body to /v1/notifications/verify-webhook-signature, never hand-rolled HMAC (PayPal's
  // signing scheme isn't a simple shared-secret HMAC). Returns false (never throws) on any
  // configuration/network failure so the caller's "reject and log, never transition" path is the
  // same for "bad signature" and "can't even ask PayPal" — both must never release files.
  async verifyWebhookSignature(headers: PayPalWebhookHeaders, eventBody: unknown): Promise<boolean> {
    if (!this.isConfigured()) {
      this.logger.warn('PayPal webhook received but PAYPAL_CLIENT_ID/SECRET/WEBHOOK_ID are not configured');
      return false;
    }
    try {
      const accessToken = await this.getAccessToken();
      const response = await fetch(`${this.apiBase}/v1/notifications/verify-webhook-signature`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transmission_id: headers.transmissionId,
          transmission_time: headers.transmissionTime,
          cert_url: headers.certUrl,
          auth_algo: headers.authAlgo,
          transmission_sig: headers.transmissionSig,
          webhook_id: this.webhookId,
          webhook_event: eventBody,
        }),
      });
      if (!response.ok) return false;
      const body = (await response.json()) as { verification_status: string };
      return body.verification_status === 'SUCCESS';
    } catch (err) {
      this.logger.error(`PayPal webhook signature verification failed: ${(err as Error).message}`);
      return false;
    }
  }
}
