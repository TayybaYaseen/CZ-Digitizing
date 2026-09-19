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

export interface PayPalCaptureInfo {
  id: string;
  status: string;
  currency: string;
  value: string;
}

// What the server learned from PayPal itself (never from the browser): the order's status, the
// buyer-approval link while it is still awaiting approval, and every capture on it.
export interface PayPalOrderState {
  id: string;
  status: string;
  approveUrl: string | null;
  // What PayPal says this order is for (purchase_units[0].amount) — checked BEFORE capturing.
  orderAmount: { currency: string; value: string } | null;
  captures: PayPalCaptureInfo[];
}

export interface CreatePayPalOrderInput {
  // Our own reference (the order id, or "credit:N"/"subscription:N") — echoed by PayPal as
  // purchase_units[0].reference_id/custom_id.
  referenceId: string;
  // Already converted by PaymentAmountService: a provider-supported currency and a two-decimal
  // string. This service never converts and never assumes PKR == the settlement currency.
  currency: string;
  amountDecimal: string;
  description?: string;
  // Where PayPal sends the buyer after approving/cancelling. Optional so credit/subscription
  // callers keep their existing (redirect-less) behaviour.
  returnUrl?: string;
  cancelUrl?: string;
  // PayPal-Request-Id: makes a retried create call return the same PayPal order instead of a new one.
  requestId?: string;
}

// docs/specs/2026-08-28-08-orders-payment-processing.md §3 (AC-1/AC-2). No @paypal/checkout-server-sdk
// dependency added — this repo has no existing HTTP client dependency (no axios anywhere in
// apps/api/package.json) and PayPal's REST API is a handful of plain JSON calls, so this uses
// Node's built-in global `fetch` (available since Node 18, this repo runs Node 20+ per
// apps/api's engines/CI image) rather than pulling in a whole SDK or a new HTTP-client dependency.
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

  // Webhook verification needs all three.
  isConfigured(): boolean {
    return Boolean(this.clientId && this.clientSecret && this.webhookId);
  }

  // Creating and capturing a payment only needs API credentials; the webhook id is only for
  // verifying inbound events. Checkout is refused unless this is true (never a silent dead-end).
  canCreatePayments(): boolean {
    return Boolean(this.clientId && this.clientSecret);
  }

  // AC-1 — called when a PayPal order is created so orders.paypal_order_id is on file BEFORE the
  // customer reaches PayPal: every later webhook/verify call resolves the order through a
  // reference this service itself wrote, never an id echoed back unverified. Returns null (and
  // logs) on any failure; the caller keeps the order payment_pending so the customer can retry.
  async createOrder(input: CreatePayPalOrderInput): Promise<{ paypalOrderId: string; approveUrl: string | null } | null> {
    if (!this.canCreatePayments()) return null;
    try {
      const accessToken = await this.getAccessToken();
      const body: Record<string, unknown> = {
        intent: 'CAPTURE',
        purchase_units: [
          {
            reference_id: input.referenceId,
            custom_id: input.referenceId,
            ...(input.description ? { description: input.description } : {}),
            amount: { currency_code: input.currency, value: input.amountDecimal },
          },
        ],
      };
      if (input.returnUrl && input.cancelUrl) {
        body.payment_source = {
          paypal: {
            experience_context: {
              return_url: input.returnUrl,
              cancel_url: input.cancelUrl,
              user_action: 'PAY_NOW',
              shipping_preference: 'NO_SHIPPING',
            },
          },
        };
      }
      const response = await fetch(`${this.apiBase}/v2/checkout/orders`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          ...(input.requestId ? { 'PayPal-Request-Id': input.requestId } : {}),
        },
        body: JSON.stringify(body),
      });
      if (!response.ok) throw new Error(`PayPal create-order failed: ${response.status}`);
      const created = (await response.json()) as { id: string; links?: { rel: string; href: string }[] };
      return { paypalOrderId: created.id, approveUrl: findApproveLink(created.links) };
    } catch (err) {
      this.logger.error(`PayPal create-order failed: ${(err as Error).message}`);
      return null;
    }
  }

  // Server-side read of the order's real state at PayPal (status + captures).
  async getOrder(paypalOrderId: string): Promise<PayPalOrderState | null> {
    if (!this.canCreatePayments()) return null;
    try {
      const accessToken = await this.getAccessToken();
      const response = await fetch(`${this.apiBase}/v2/checkout/orders/${encodeURIComponent(paypalOrderId)}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!response.ok) {
        this.logger.warn(`PayPal get-order ${paypalOrderId} failed: ${response.status}`);
        return null;
      }
      return toOrderState(await response.json());
    } catch (err) {
      this.logger.error(`PayPal get-order failed: ${(err as Error).message}`);
      return null;
    }
  }

  // Captures a buyer-approved order server-side. The result is PayPal's own answer; the caller
  // still compares the captured amount/currency against the order before trusting it. Safe to call
  // twice: PayPal-Request-Id makes a retry idempotent, and an already-captured order is re-read.
  async captureOrder(paypalOrderId: string, requestId: string): Promise<PayPalOrderState | null> {
    if (!this.canCreatePayments()) return null;
    try {
      const accessToken = await this.getAccessToken();
      const response = await fetch(`${this.apiBase}/v2/checkout/orders/${encodeURIComponent(paypalOrderId)}/capture`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'PayPal-Request-Id': requestId,
          Prefer: 'return=representation',
        },
        body: '{}',
      });
      if (response.ok) return toOrderState(await response.json());

      const errorBody = (await response.json().catch(() => null)) as { details?: { issue?: string }[] } | null;
      if (errorBody?.details?.some((d) => d.issue === 'ORDER_ALREADY_CAPTURED')) return this.getOrder(paypalOrderId);
      this.logger.warn(`PayPal capture ${paypalOrderId} failed: ${response.status} ${JSON.stringify(errorBody?.details ?? [])}`);
      return null;
    } catch (err) {
      this.logger.error(`PayPal capture failed: ${(err as Error).message}`);
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

// With payment_source.paypal.experience_context PayPal returns the buyer link as "payer-action";
// the classic (no payment_source) create returns "approve". Accept either.
function findApproveLink(links: { rel: string; href: string }[] | undefined): string | null {
  return links?.find((l) => l.rel === 'payer-action')?.href ?? links?.find((l) => l.rel === 'approve')?.href ?? null;
}

function toOrderState(body: unknown): PayPalOrderState {
  const order = body as {
    id: string;
    status: string;
    links?: { rel: string; href: string }[];
    purchase_units?: { amount?: { currency_code?: string; value?: string }; payments?: { captures?: { id: string; status: string; amount?: { currency_code?: string; value?: string } }[] } }[];
  };
  const unit = order.purchase_units?.[0];
  const captures = unit?.payments?.captures ?? [];
  return {
    id: order.id,
    status: order.status,
    approveUrl: findApproveLink(order.links),
    orderAmount: unit?.amount?.currency_code && unit.amount.value ? { currency: unit.amount.currency_code, value: unit.amount.value } : null,
    captures: captures.map((c) => ({ id: c.id, status: c.status, currency: c.amount?.currency_code ?? '', value: c.amount?.value ?? '' })),
  };
}
