import { Controller, HttpCode, Logger, Post, Req, RawBodyRequest } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { ApiException } from '../common/exceptions/api-exception';
import { Public } from '../common/decorators/public.decorator';
import { PayPalService } from './payments/paypal.service';
import { StripeService } from './payments/stripe.service';
import { OrdersService } from './orders.service';

// docs/specs/2026-08-28-08-orders-payment-processing.md §3 (AC-1/AC-2/AC-10). Public — not
// user-invocable, no @Roles/JWT gate — but every event is signature-verified before anything is
// trusted from it (AC-2: a failed verification never transitions an order and is logged, not
// silently swallowed).
@ApiTags('webhooks')
@Controller('api/webhooks')
export class WebhooksController {
  private readonly logger = new Logger(WebhooksController.name);

  constructor(
    private readonly paypal: PayPalService,
    private readonly stripe: StripeService,
    private readonly orders: OrdersService,
  ) {}

  @Post('paypal')
  @Public()
  @HttpCode(200)
  async paypal_(@Req() req: Request) {
    const headers = {
      transmissionId: String(req.headers['paypal-transmission-id'] ?? ''),
      transmissionTime: String(req.headers['paypal-transmission-time'] ?? ''),
      certUrl: String(req.headers['paypal-cert-url'] ?? ''),
      authAlgo: String(req.headers['paypal-auth-algo'] ?? ''),
      transmissionSig: String(req.headers['paypal-transmission-sig'] ?? ''),
    };

    const verified = await this.paypal.verifyWebhookSignature(headers, req.body);
    if (!verified) {
      this.logger.error(`PayPal webhook signature verification failed for event ${(req.body as { id?: string })?.id ?? 'unknown'}`);
      throw new ApiException('INVALID_WEBHOOK_SIGNATURE', 422, 'PayPal webhook signature verification failed');
    }

    const event = req.body as { event_type: string; resource: Record<string, unknown> };
    // AC-1 — only the capture-completed event actually confirms payment; every other subscribed
    // event type (declined, refunded-by-PayPal-directly, etc.) is acknowledged with 200 but not
    // acted on here, which is the correct "not yet handled" response for a webhook endpoint.
    if (event.event_type === 'PAYMENT.CAPTURE.COMPLETED') {
      const resource = event.resource as { id: string; supplementary_data?: { related_ids?: { order_id?: string } } };
      const orderRef = resource.supplementary_data?.related_ids?.order_id;
      const orderId = orderRef ? await this.orders.findByPaypalOrderId(orderRef) : null;
      if (orderId) {
        await this.orders.confirmAutomaticPayment(orderId, 'paypal', { paypalOrderId: orderRef, paypalCaptureId: resource.id });
      } else {
        this.logger.error(`PayPal capture ${resource.id} has no matching order reference`);
      }
    }

    return { received: true };
  }

  @Post('stripe')
  @Public()
  @HttpCode(200)
  async stripe_(@Req() req: RawBodyRequest<Request>) {
    const signature = req.headers['stripe-signature'];
    if (!signature || !req.rawBody) {
      throw new ApiException('INVALID_WEBHOOK_SIGNATURE', 422, 'Stripe webhook signature or raw body missing');
    }

    const event = this.stripe.verifyAndParseEvent(req.rawBody, Array.isArray(signature) ? signature[0] : signature);
    if (!event) {
      this.logger.error('Stripe webhook signature verification failed');
      throw new ApiException('INVALID_WEBHOOK_SIGNATURE', 422, 'Stripe webhook signature verification failed');
    }

    // AC-10 — this webhook's job is only to react to the final payment_intent.succeeded event;
    // 3D Secure itself is handled client-side by Stripe.js/Payment Element before this ever fires.
    if (event.type === 'payment_intent.succeeded') {
      const intent = event.data.object as { id: string; metadata?: Record<string, string> };
      const orderId = this.resolveOrderIdFromMetadata(intent.metadata);
      if (orderId) {
        await this.orders.confirmAutomaticPayment(orderId, 'stripe', { stripePaymentIntentId: intent.id });
      } else {
        this.logger.error(`Stripe payment_intent ${intent.id} has no orderId in metadata`);
      }
    }

    return { received: true };
  }

  // Stripe's PaymentIntent metadata.orderId is set when the PaymentIntent itself is created
  // (checkout's own "create payment intent" call, outside this webhook). Never trust a bare
  // numeric id unverified — this is a plain parse, not a DB lookup, because Stripe's own signature
  // verification (already passed by the time this runs) is what makes the metadata trustworthy.
  private resolveOrderIdFromMetadata(metadata: Record<string, string> | undefined): bigint | null {
    if (!metadata?.orderId) return null;
    try {
      return BigInt(metadata.orderId);
    } catch {
      return null;
    }
  }
}
