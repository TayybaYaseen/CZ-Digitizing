import { PayPalService } from './paypal.service';

const ENV = {
  PAYPAL_CLIENT_ID: 'client-id',
  PAYPAL_CLIENT_SECRET: 'client-secret',
  PAYPAL_WEBHOOK_ID: 'webhook-id',
  PAYPAL_API_BASE: 'https://paypal.test',
};

function makeService(env: Partial<typeof ENV> = ENV) {
  return new PayPalService({ get: (key: string) => (env as Record<string, string | undefined>)[key] } as never);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Call = { url: string; method: string; headers: Record<string, string>; body: any };

// A scripted fake of PayPal's REST API (there are no real sandbox credentials in this repo). It
// records every request so tests can assert exactly what was SENT to PayPal.
function installFetch(handlers: Record<string, (call: Call) => { status?: number; body: unknown }>) {
  const calls: Call[] = [];
  const spy = jest.spyOn(global, 'fetch').mockImplementation((async (url: string, init?: RequestInit) => {
    const raw = init?.body;
    const call: Call = {
      url: String(url),
      method: (init?.method ?? 'GET').toUpperCase(),
      headers: (init?.headers ?? {}) as Record<string, string>,
      body: typeof raw === 'string' && raw.startsWith('{') ? JSON.parse(raw) : raw,
    };
    calls.push(call);
    if (call.url.endsWith('/v1/oauth2/token')) return { ok: true, status: 200, json: async () => ({ access_token: 'tok' }) } as Response;
    const path = call.url.replace('https://paypal.test', '');
    const key = Object.keys(handlers).find((k) => k === `${call.method} ${path}`);
    if (!key) return { ok: false, status: 404, json: async () => ({}) } as Response;
    const out = handlers[key](call);
    const status = out.status ?? 200;
    return { ok: status < 400, status, json: async () => out.body } as Response;
  }) as typeof fetch);
  return { calls, spy };
}

afterEach(() => jest.restoreAllMocks());

describe('PayPalService.createOrder (A-013: correct amount/currency, real approval link)', () => {
  it('sends the CONVERTED amount and currency it was given — never a PKR figure relabelled as USD', async () => {
    const { calls } = installFetch({
      'POST /v2/checkout/orders': () => ({ body: { id: 'PP-1', links: [{ rel: 'payer-action', href: 'https://paypal.test/approve/PP-1' }] } }),
    });
    const created = await makeService().createOrder({
      referenceId: '42',
      currency: 'USD',
      amountDecimal: '5.39', // = PKR 1,500 at 278.5
      returnUrl: 'https://shop.test/checkout/pay/42?paypal=return',
      cancelUrl: 'https://shop.test/checkout/pay/42?paypal=cancel',
      requestId: 'req-1',
    });

    const create = calls.find((c) => c.url.endsWith('/v2/checkout/orders'))!;
    expect(create.body.purchase_units[0].amount).toEqual({ currency_code: 'USD', value: '5.39' });
    expect(create.body.purchase_units[0].amount.value).not.toBe('1500.00');
    expect(create.body.purchase_units[0].reference_id).toBe('42');
    expect(create.body.intent).toBe('CAPTURE');
    expect(create.headers['PayPal-Request-Id']).toBe('req-1');
    expect(create.body.payment_source.paypal.experience_context).toMatchObject({
      return_url: 'https://shop.test/checkout/pay/42?paypal=return',
      cancel_url: 'https://shop.test/checkout/pay/42?paypal=cancel',
      user_action: 'PAY_NOW',
    });
    expect(created).toEqual({ paypalOrderId: 'PP-1', approveUrl: 'https://paypal.test/approve/PP-1' });
  });

  it('also accepts the classic "approve" link and omits payment_source when no return URL is given', async () => {
    const { calls } = installFetch({
      'POST /v2/checkout/orders': () => ({ body: { id: 'PP-2', links: [{ rel: 'approve', href: 'https://paypal.test/a' }] } }),
    });
    const created = await makeService().createOrder({ referenceId: 'credit:1', currency: 'USD', amountDecimal: '1.00' });
    expect(created?.approveUrl).toBe('https://paypal.test/a');
    expect(calls.find((c) => c.url.endsWith('/v2/checkout/orders'))!.body.payment_source).toBeUndefined();
  });

  it('returns null (never throws) when unconfigured or when PayPal errors', async () => {
    installFetch({ 'POST /v2/checkout/orders': () => ({ status: 500, body: {} }) });
    expect(await makeService({}).createOrder({ referenceId: '1', currency: 'USD', amountDecimal: '1.00' })).toBeNull();
    expect(await makeService().createOrder({ referenceId: '1', currency: 'USD', amountDecimal: '1.00' })).toBeNull();
  });

  it('canCreatePayments needs only API credentials; isConfigured also needs the webhook id', () => {
    const noWebhook = makeService({ ...ENV, PAYPAL_WEBHOOK_ID: undefined });
    expect(noWebhook.canCreatePayments()).toBe(true);
    expect(noWebhook.isConfigured()).toBe(false);
    expect(makeService({}).canCreatePayments()).toBe(false);
  });
});

describe('PayPalService.getOrder / captureOrder (server-side verification)', () => {
  const completedBody = {
    id: 'PP-1',
    status: 'COMPLETED',
    purchase_units: [{ amount: { currency_code: 'USD', value: '5.39' }, payments: { captures: [{ id: 'CAP-1', status: 'COMPLETED', amount: { currency_code: 'USD', value: '5.39' } }] } }],
  };

  it('getOrder reports status, the order amount and every capture as PayPal states them', async () => {
    installFetch({ 'GET /v2/checkout/orders/PP-1': () => ({ body: completedBody }) });
    const state = await makeService().getOrder('PP-1');
    expect(state).toEqual({
      id: 'PP-1',
      status: 'COMPLETED',
      approveUrl: null,
      orderAmount: { currency: 'USD', value: '5.39' },
      captures: [{ id: 'CAP-1', status: 'COMPLETED', currency: 'USD', value: '5.39' }],
    });
  });

  it('getOrder returns null on a PayPal error', async () => {
    installFetch({ 'GET /v2/checkout/orders/PP-9': () => ({ status: 404, body: {} }) });
    expect(await makeService().getOrder('PP-9')).toBeNull();
  });

  it('captureOrder POSTs to /capture with an idempotency key and returns PayPal\'s answer', async () => {
    const { calls } = installFetch({ 'POST /v2/checkout/orders/PP-1/capture': () => ({ status: 201, body: completedBody }) });
    const state = await makeService().captureOrder('PP-1', 'czd-capture-42');
    const capture = calls.find((c) => c.url.endsWith('/capture'))!;
    expect(capture.headers['PayPal-Request-Id']).toBe('czd-capture-42');
    expect(state?.captures[0]).toMatchObject({ id: 'CAP-1', value: '5.39' });
  });

  it('captureOrder on an already-captured order falls back to reading the order', async () => {
    installFetch({
      'POST /v2/checkout/orders/PP-1/capture': () => ({ status: 422, body: { details: [{ issue: 'ORDER_ALREADY_CAPTURED' }] } }),
      'GET /v2/checkout/orders/PP-1': () => ({ body: completedBody }),
    });
    expect((await makeService().captureOrder('PP-1', 'r'))?.status).toBe('COMPLETED');
  });

  it('captureOrder returns null when PayPal refuses', async () => {
    installFetch({ 'POST /v2/checkout/orders/PP-1/capture': () => ({ status: 422, body: { details: [{ issue: 'INSTRUMENT_DECLINED' }] } }) });
    expect(await makeService().captureOrder('PP-1', 'r')).toBeNull();
  });
});

describe('PayPalService.verifyWebhookSignature (AC-2)', () => {
  const headers = { transmissionId: 't', transmissionTime: 'now', certUrl: 'https://c', authAlgo: 'SHA256', transmissionSig: 's' };

  it('is true only when PayPal itself answers SUCCESS, and forwards our webhook id', async () => {
    const { calls } = installFetch({ 'POST /v1/notifications/verify-webhook-signature': () => ({ body: { verification_status: 'SUCCESS' } }) });
    expect(await makeService().verifyWebhookSignature(headers, { id: 'evt' })).toBe(true);
    expect(calls.find((c) => c.url.endsWith('verify-webhook-signature'))!.body.webhook_id).toBe('webhook-id');
  });

  it('is false for FAILURE, for a PayPal error, and when unconfigured (without calling PayPal)', async () => {
    installFetch({ 'POST /v1/notifications/verify-webhook-signature': () => ({ body: { verification_status: 'FAILURE' } }) });
    expect(await makeService().verifyWebhookSignature(headers, {})).toBe(false);

    jest.restoreAllMocks();
    installFetch({ 'POST /v1/notifications/verify-webhook-signature': () => ({ status: 500, body: {} }) });
    expect(await makeService().verifyWebhookSignature(headers, {})).toBe(false);

    jest.restoreAllMocks();
    const { spy } = installFetch({});
    expect(await makeService({}).verifyWebhookSignature(headers, {})).toBe(false);
    expect(spy).not.toHaveBeenCalled();
  });

  it('is false (never throws) when the network fails', async () => {
    jest.spyOn(global, 'fetch').mockRejectedValue(new Error('offline'));
    expect(await makeService().verifyWebhookSignature(headers, {})).toBe(false);
  });
});
