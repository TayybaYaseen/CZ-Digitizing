import { StripeService } from './stripe.service';

const ENV: Record<string, string | undefined> = {
  STRIPE_SECRET_KEY: 'sk_test_unit',
  STRIPE_WEBHOOK_SECRET: 'whsec_unit',
  STRIPE_PUBLISHABLE_KEY: 'pk_test_unit',
};

function makeService(env: Record<string, string | undefined> = ENV) {
  return new StripeService({ get: (key: string) => env[key] } as never);
}

describe('StripeService.createPaymentIntent (A-013: correct amount/currency, client secret for 3-D Secure)', () => {
  it('creates the intent with the CONVERTED minor-unit amount, lowercase currency, our order reference and automatic payment methods', async () => {
    const service = makeService();
    const create = jest.fn(async () => ({ id: 'pi_1', client_secret: 'pi_1_secret_x' }));
    (service as unknown as { client: unknown }).client = { paymentIntents: { create } };

    const result = await service.createPaymentIntent({ referenceId: '42', currency: 'USD', amountMinor: 539, idempotencyKey: 'czd-order-42-pi-first' });

    expect(create).toHaveBeenCalledWith(
      { amount: 539, currency: 'usd', automatic_payment_methods: { enabled: true }, metadata: { orderId: '42' } },
      { idempotencyKey: 'czd-order-42-pi-first' },
    );
    // The audit found Rs 1,500 sent as 150,000 cents:
    expect((create.mock.calls[0] as unknown[])[0]).not.toMatchObject({ amount: 150000 });
    expect(result).toEqual({ paymentIntentId: 'pi_1', clientSecret: 'pi_1_secret_x' });
  });

  it('returns null when Stripe is not configured or the API call fails', async () => {
    expect(await makeService({}).createPaymentIntent({ referenceId: '1', currency: 'USD', amountMinor: 100 })).toBeNull();

    const service = makeService();
    (service as unknown as { client: unknown }).client = { paymentIntents: { create: jest.fn(async () => { throw new Error('boom'); }) } };
    expect(await service.createPaymentIntent({ referenceId: '1', currency: 'USD', amountMinor: 100 })).toBeNull();
  });

  it('exposes the publishable key and requires it (with the secret key) before payments can be created', () => {
    expect(makeService().publishableKey()).toBe('pk_test_unit');
    expect(makeService().canCreatePayments()).toBe(true);
    expect(makeService({ ...ENV, STRIPE_PUBLISHABLE_KEY: undefined }).canCreatePayments()).toBe(false);
    expect(makeService({}).canCreatePayments()).toBe(false);
  });
});

describe('StripeService.retrievePaymentIntent', () => {
  it('returns Stripe\'s intent, or null when Stripe errors / is unconfigured', async () => {
    const service = makeService();
    (service as unknown as { client: unknown }).client = { paymentIntents: { retrieve: jest.fn(async () => ({ id: 'pi_1', status: 'succeeded' })) } };
    expect(await service.retrievePaymentIntent('pi_1')).toMatchObject({ status: 'succeeded' });

    (service as unknown as { client: unknown }).client = { paymentIntents: { retrieve: jest.fn(async () => { throw new Error('nope'); }) } };
    expect(await service.retrievePaymentIntent('pi_1')).toBeNull();
    expect(await makeService({}).retrievePaymentIntent('pi_1')).toBeNull();
  });
});

// These use the REAL Stripe SDK signature scheme (constructEvent / generateTestHeaderString) — no
// mocking of the verification itself.
describe('StripeService.verifyAndParseEvent (AC-2/AC-10 — real Stripe signature verification)', () => {
  const payload = JSON.stringify({ id: 'evt_1', object: 'event', type: 'payment_intent.succeeded', data: { object: { id: 'pi_1' } } });
  const sign = (service: StripeService, body: string, secret: string) =>
    (service as unknown as { client: { webhooks: { generateTestHeaderString: (o: { payload: string; secret: string }) => string } } }).client.webhooks.generateTestHeaderString({ payload: body, secret });

  it('accepts a correctly signed event', () => {
    const service = makeService();
    const event = service.verifyAndParseEvent(Buffer.from(payload), sign(service, payload, 'whsec_unit'));
    expect(event?.type).toBe('payment_intent.succeeded');
  });

  it('rejects a wrong secret, a tampered body, and garbage headers', () => {
    const service = makeService();
    expect(service.verifyAndParseEvent(Buffer.from(payload), sign(service, payload, 'whsec_WRONG'))).toBeNull();
    expect(service.verifyAndParseEvent(Buffer.from(payload.replace('pi_1', 'pi_2')), sign(service, payload, 'whsec_unit'))).toBeNull();
    expect(service.verifyAndParseEvent(Buffer.from(payload), 'not-a-signature')).toBeNull();
  });

  it('rejects everything when not configured', () => {
    const configured = makeService();
    const header = sign(configured, payload, 'whsec_unit');
    expect(makeService({ STRIPE_SECRET_KEY: 'sk_test_unit' }).verifyAndParseEvent(Buffer.from(payload), header)).toBeNull();
    expect(makeService({}).verifyAndParseEvent(Buffer.from(payload), header)).toBeNull();
  });
});
