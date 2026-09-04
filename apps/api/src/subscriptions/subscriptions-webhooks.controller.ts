import { Controller, HttpCode, Logger, Post, Req, RawBodyRequest } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { ApiException } from '../common/exceptions/api-exception';
import { Public } from '../common/decorators/public.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { PayPalService } from '../orders/payments/paypal.service';
import { StripeService } from '../orders/payments/stripe.service';
import { SubscriptionsService } from './subscriptions.service';

// AC-2/AC-3 — mirrors credits-webhooks.controller.ts exactly, resolving against
// PendingSubscriptionPayment instead of PendingCreditPurchase.
@ApiTags('webhooks')
@Controller('api/webhooks/subscriptions')
export class SubscriptionsWebhooksController {
  private readonly logger = new Logger(SubscriptionsWebhooksController.name);

  constructor(
    private readonly paypal: PayPalService,
    private readonly stripe: StripeService,
    private readonly subscriptions: SubscriptionsService,
    private readonly prisma: PrismaService,
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
    if (!verified) throw new ApiException('INVALID_WEBHOOK_SIGNATURE', 422, 'PayPal webhook signature verification failed');

    const event = req.body as { event_type: string; resource: Record<string, unknown> };
    if (event.event_type === 'PAYMENT.CAPTURE.COMPLETED') {
      const resource = event.resource as { supplementary_data?: { related_ids?: { order_id?: string } } };
      const paypalOrderId = resource.supplementary_data?.related_ids?.order_id;
      const pending = paypalOrderId ? await this.prisma.pendingSubscriptionPayment.findUnique({ where: { paypalOrderId } }) : null;
      if (pending) {
        await this.subscriptions.confirmPayment(pending.id);
      } else {
        this.logger.error(`PayPal capture has no matching pending subscription payment for order ${paypalOrderId}`);
      }
    }
    return { received: true };
  }

  @Post('stripe')
  @Public()
  @HttpCode(200)
  async stripe_(@Req() req: RawBodyRequest<Request>) {
    const signature = req.headers['stripe-signature'];
    if (!signature || !req.rawBody) throw new ApiException('INVALID_WEBHOOK_SIGNATURE', 422, 'Stripe webhook signature or raw body missing');

    const event = this.stripe.verifyAndParseEvent(req.rawBody, Array.isArray(signature) ? signature[0] : signature);
    if (!event) throw new ApiException('INVALID_WEBHOOK_SIGNATURE', 422, 'Stripe webhook signature verification failed');

    if (event.type === 'payment_intent.succeeded') {
      const intent = event.data.object as { id: string; metadata?: Record<string, string> };
      const pendingId = this.resolvePendingId(intent.metadata);
      if (pendingId !== null) {
        await this.subscriptions.confirmPayment(pendingId);
      } else {
        this.logger.error(`Stripe payment_intent ${intent.id} is not a recognized subscription-payment reference`);
      }
    }
    return { received: true };
  }

  private resolvePendingId(metadata: Record<string, string> | undefined): bigint | null {
    const raw = metadata?.orderId;
    if (!raw?.startsWith('subscription:')) return null;
    try {
      return BigInt(raw.slice('subscription:'.length));
    } catch {
      return null;
    }
  }
}
