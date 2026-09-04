import { Controller, HttpCode, Logger, Post, Req, RawBodyRequest } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { ApiException } from '../common/exceptions/api-exception';
import { Public } from '../common/decorators/public.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { PayPalService } from '../orders/payments/paypal.service';
import { StripeService } from '../orders/payments/stripe.service';
import { CreditsService } from './credits.service';

// AC-6 — mirrors orders/webhooks.controller.ts's structure exactly (signature-verify first, act
// only on the one event that actually confirms payment), but resolves against
// PendingCreditPurchase instead of an Order row.
@ApiTags('webhooks')
@Controller('api/webhooks/credits')
export class CreditsWebhooksController {
  private readonly logger = new Logger(CreditsWebhooksController.name);

  constructor(
    private readonly paypal: PayPalService,
    private readonly stripe: StripeService,
    private readonly credits: CreditsService,
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
      const pending = paypalOrderId ? await this.prisma.pendingCreditPurchase.findUnique({ where: { paypalOrderId } }) : null;
      if (pending) {
        await this.credits.confirmPurchase(pending.id);
      } else {
        this.logger.error(`PayPal capture has no matching pending credit purchase for order ${paypalOrderId}`);
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
        await this.credits.confirmPurchase(pendingId);
      } else {
        this.logger.error(`Stripe payment_intent ${intent.id} is not a recognized credit-purchase reference`);
      }
    }
    return { received: true };
  }

  // Stripe's metadata.orderId (StripeService.createPaymentIntent's generic param) is set to
  // `credit:<pendingId>` for a credit purchase — see CreditsService.purchase().
  private resolvePendingId(metadata: Record<string, string> | undefined): bigint | null {
    const raw = metadata?.orderId;
    if (!raw?.startsWith('credit:')) return null;
    try {
      return BigInt(raw.slice('credit:'.length));
    } catch {
      return null;
    }
  }
}
