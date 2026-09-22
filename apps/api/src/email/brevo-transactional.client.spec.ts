import { BrevoTransactionalClient } from './brevo-transactional.client';

describe('BrevoTransactionalClient', () => {
  const fetchMock = jest.fn();
  const realFetch = global.fetch;
  const client = new BrevoTransactionalClient('xkeysib-secret-test-key', { email: 'sender@example.com', name: 'CZ Digitizing' });

  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;
  });
  afterAll(() => {
    global.fetch = realFetch;
  });

  it('POSTs to the Brevo transactional endpoint with the api-key header and the sender/recipient/content mapped', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 201 });

    await client.send({ to: 'admin@example.com', subject: 'Subj', text: 'Plain', html: '<p>Rich</p>' });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.brevo.com/v3/smtp/email');
    expect(init.method).toBe('POST');
    expect(init.headers['api-key']).toBe('xkeysib-secret-test-key');
    expect(JSON.parse(init.body)).toEqual({
      sender: { email: 'sender@example.com', name: 'CZ Digitizing' },
      to: [{ email: 'admin@example.com' }],
      subject: 'Subj',
      textContent: 'Plain',
      htmlContent: '<p>Rich</p>',
    });
  });

  it('omits htmlContent for plain-text messages', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 201 });

    await client.send({ to: 'admin@example.com', subject: 'Subj', text: 'Plain' });

    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).not.toHaveProperty('htmlContent');
  });

  it('throws on a non-2xx response with the status and Brevo message, and never includes the API key', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 401, json: () => Promise.resolve({ message: 'Key not found' }) });

    const error = await client.send({ to: 'admin@example.com', subject: 'Subj', text: 'Plain' }).catch((e: Error) => e);

    expect((error as Error).message).toBe('Brevo send failed (HTTP 401): Key not found');
    expect((error as Error).message).not.toContain('xkeysib');
  });

  it('still throws with just the status when the error body is not JSON', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 502, json: () => Promise.reject(new Error('not json')) });

    await expect(client.send({ to: 'a@example.com', subject: 'S', text: 'T' })).rejects.toThrow('Brevo send failed (HTTP 502)');
  });
});
