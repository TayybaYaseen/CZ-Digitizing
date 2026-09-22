import { Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { EmailService } from './email.service';

jest.mock('nodemailer');

function createFakeConfig(overrides: Record<string, string | number> = {}) {
  const values: Record<string, string | number> = {
    EMAIL_FROM: 'CZ Digitizing <no-reply@czdigitizing.com>',
    ...overrides,
  };
  return { get: (key: string) => values[key] };
}

describe('EmailService transport selection', () => {
  const sendMail = jest.fn().mockResolvedValue(undefined);
  const createTransport = nodemailer.createTransport as unknown as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    createTransport.mockReturnValue({ sendMail });
  });

  it('uses the Brevo SMTP relay when BREVO_CUSTOMER_API_KEY and login are set, keeping the existing sender', async () => {
    const service = new EmailService(
      createFakeConfig({ BREVO_CUSTOMER_API_KEY: 'xsmtpsib-test', BREVO_CUSTOMER_SMTP_LOGIN: 'login@smtp-brevo.com' }) as never,
    );

    expect(createTransport).toHaveBeenCalledWith({
      host: 'smtp-relay.brevo.com',
      port: 587,
      auth: { user: 'login@smtp-brevo.com', pass: 'xsmtpsib-test' },
    });

    await service.send({ to: 'c@example.com', subject: 'Subject', text: 'Body', html: '<p>Body</p>' });
    expect(sendMail).toHaveBeenCalledWith({
      from: 'CZ Digitizing <no-reply@czdigitizing.com>',
      to: 'c@example.com',
      subject: 'Subject',
      text: 'Body',
      html: '<p>Body</p>',
    });
  });

  it('takes precedence over generic SMTP_* when both are configured', () => {
    new EmailService(
      createFakeConfig({
        BREVO_CUSTOMER_API_KEY: 'xsmtpsib-test',
        BREVO_CUSTOMER_SMTP_LOGIN: 'login@smtp-brevo.com',
        SMTP_HOST: 'smtp.other.example',
      }) as never,
    );

    expect(createTransport).toHaveBeenCalledTimes(1);
    expect(createTransport).toHaveBeenCalledWith(expect.objectContaining({ host: 'smtp-relay.brevo.com' }));
  });

  it('does not activate Brevo without a login (key alone) and falls back to the previous behaviour', async () => {
    const service = new EmailService(createFakeConfig({ BREVO_CUSTOMER_API_KEY: 'xsmtpsib-test' }) as never);

    expect(createTransport).not.toHaveBeenCalled();
    await service.send({ to: 'c@example.com', subject: 'Subject', text: 'Body' });
    expect(sendMail).not.toHaveBeenCalled();
  });

  it('keeps using generic SMTP_* when Brevo is not configured', () => {
    new EmailService(
      createFakeConfig({ SMTP_HOST: 'smtp.other.example', SMTP_PORT: 2525, SMTP_USER: 'u', SMTP_PASS: 'p' }) as never,
    );

    expect(createTransport).toHaveBeenCalledWith({ host: 'smtp.other.example', port: 2525, auth: { user: 'u', pass: 'p' } });
  });

  describe('admin audience (Brevo Transactional API)', () => {
    const fetchMock = jest.fn();
    const realFetch = global.fetch;
    const adminConfig = {
      BREVO_ADMIN_API_KEY: 'xkeysib-admin-test',
      BREVO_ADMIN_SENDER_EMAIL: 'admin-sender@example.com',
      BREVO_ADMIN_SENDER_NAME: 'CZ Digitizing',
    };

    beforeEach(() => {
      fetchMock.mockReset().mockResolvedValue({ ok: true, status: 201 });
      global.fetch = fetchMock as unknown as typeof fetch;
    });
    afterAll(() => {
      global.fetch = realFetch;
    });

    it('sends audience:"admin" emails via Brevo with the admin sender, not the SMTP transport', async () => {
      const service = new EmailService(
        createFakeConfig({ ...adminConfig, BREVO_CUSTOMER_API_KEY: 'xsmtpsib-c', BREVO_CUSTOMER_SMTP_LOGIN: 'l@smtp-brevo.com' }) as never,
      );

      await service.send({ to: 'admin@example.com', subject: 'Subj', text: 'Body', html: '<p>Body</p>', audience: 'admin' });

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock.mock.calls[0][1].headers['api-key']).toBe('xkeysib-admin-test');
      expect(JSON.parse(fetchMock.mock.calls[0][1].body).sender).toEqual({ email: 'admin-sender@example.com', name: 'CZ Digitizing' });
      expect(sendMail).not.toHaveBeenCalled();
    });

    it('never routes emails without audience:"admin" through the admin Brevo key', async () => {
      const service = new EmailService(
        createFakeConfig({ ...adminConfig, BREVO_CUSTOMER_API_KEY: 'xsmtpsib-c', BREVO_CUSTOMER_SMTP_LOGIN: 'l@smtp-brevo.com' }) as never,
      );

      await service.send({ to: 'customer@example.com', subject: 'Subj', text: 'Body' });

      expect(fetchMock).not.toHaveBeenCalled();
      expect(sendMail).toHaveBeenCalledTimes(1);
    });

    it('does not leak the audience flag into the SMTP mail options when admin Brevo is not configured', async () => {
      const service = new EmailService(createFakeConfig({ SMTP_HOST: 'smtp.other.example' }) as never);

      await service.send({ to: 'admin@example.com', subject: 'Subj', text: 'Body', audience: 'admin' });

      expect(fetchMock).not.toHaveBeenCalled();
      expect(sendMail).toHaveBeenCalledWith({
        from: 'CZ Digitizing <no-reply@czdigitizing.com>',
        to: 'admin@example.com',
        subject: 'Subj',
        text: 'Body',
      });
    });

    it('is inactive when only the key is set (no sender email)', async () => {
      const service = new EmailService(createFakeConfig({ BREVO_ADMIN_API_KEY: 'xkeysib-admin-test' }) as never);

      await service.send({ to: 'admin@example.com', subject: 'Subj', text: 'Body', audience: 'admin' });

      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('propagates a Brevo failure instead of silently falling back to another transport', async () => {
      fetchMock.mockResolvedValue({ ok: false, status: 401, json: () => Promise.resolve({ message: 'Key not found' }) });
      const service = new EmailService(createFakeConfig({ ...adminConfig, SMTP_HOST: 'smtp.other.example' }) as never);

      await expect(service.send({ to: 'admin@example.com', subject: 'S', text: 'T', audience: 'admin' })).rejects.toThrow('HTTP 401');
      expect(sendMail).not.toHaveBeenCalled();
    });
  });

  describe('failure handling', () => {
    afterEach(() => jest.restoreAllMocks());

    it('throws (and logs an error) in production instead of pretending an email was sent when no transport is configured', async () => {
      const errorLog = jest.spyOn(Logger.prototype, 'error').mockImplementation();
      const service = new EmailService(createFakeConfig({ NODE_ENV: 'production' }) as never);

      await expect(service.send({ to: 'c@example.com', subject: 'Subject', text: 'Body' })).rejects.toThrow('Email transport is not configured');
      expect(errorLog).toHaveBeenCalledWith(expect.stringContaining('Email NOT sent to c@example.com'));
    });

    it('keeps the dev console fallback outside production but warns that nothing was delivered', async () => {
      const warnLog = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
      const service = new EmailService(createFakeConfig({ NODE_ENV: 'development' }) as never);

      await expect(service.send({ to: 'c@example.com', subject: 'Subject', text: 'Body' })).resolves.toBeUndefined();
      expect(warnLog).toHaveBeenCalledWith(expect.stringContaining('NOT SENT'));
    });

    it('logs a useful SMTP error, masks credentials, and rethrows so the caller still sees the failure', async () => {
      const errorLog = jest.spyOn(Logger.prototype, 'error').mockImplementation();
      const failure = Object.assign(new Error('Invalid login: 535 Authentication failed for xsmtpsib-topsecret'), { code: 'EAUTH', responseCode: 535 });
      sendMail.mockRejectedValueOnce(failure);
      const service = new EmailService(
        createFakeConfig({ BREVO_CUSTOMER_API_KEY: 'xsmtpsib-topsecret', BREVO_CUSTOMER_SMTP_LOGIN: 'login@smtp-brevo.com' }) as never,
      );

      await expect(service.send({ to: 'c@example.com', subject: 'Subject', text: 'Body' })).rejects.toBe(failure);

      const logged = errorLog.mock.calls[0][0] as string;
      expect(logged).toContain('EAUTH 535');
      expect(logged).toContain('c@example.com');
      expect(logged).not.toContain('xsmtpsib-topsecret');
    });
  });

  it('logs to the console (no transport) when nothing is configured', async () => {
    const service = new EmailService(createFakeConfig() as never);

    expect(createTransport).not.toHaveBeenCalled();
    await service.send({ to: 'c@example.com', subject: 'Subject', text: 'Body' });
    expect(sendMail).not.toHaveBeenCalled();
  });
});
