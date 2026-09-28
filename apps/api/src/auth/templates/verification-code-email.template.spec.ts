import {
  renderPasswordResetEmail,
  renderVerificationCodeEmail,
  renderWelcomeEmail,
  type VerificationEmailInput,
} from './verification-code-email.template';

const base: VerificationEmailInput = {
  code: '6242',
  expiresInMinutes: 15,
  webBaseUrl: 'https://czdigitizing.example',
  contact: { contactEmail: 'help@czdigitizing.example', whatsappNumber: '+92 317 4604508' },
};

describe('renderVerificationCodeEmail (login / new-device code)', () => {
  it('sign-in copy with the security panel, code kept out of the subject', () => {
    const email = renderVerificationCodeEmail(base);

    expect(email.subject).toBe('Your CZ Digitizing login verification code');
    expect(email.subject).not.toContain('6242');
    expect(email.html).toContain('Your login verification code');
    expect(email.html).toContain('securely sign in to your CZ Digitizing account');
    expect(email.html).toContain('>6242</div>');
    expect(email.html).toContain('15 minutes');
    expect(email.html).toContain('consider reviewing your account security');
    expect(email.html).toContain('href="https://czdigitizing.example/forgot-password"');
  });

  it('keeps the code as the first 4-digit run in the text part (what lastEmailCodeTo scans for)', () => {
    expect(/\b(\d{4})\b/.exec(renderVerificationCodeEmail(base).text)?.[1]).toBe('6242');
  });

  it('footer uses the configured contact details, and omits whichever are unset', () => {
    const full = renderVerificationCodeEmail(base);
    expect(full.html).toContain('mailto:help@czdigitizing.example');
    expect(full.html).toContain('https://wa.me/923174604508');

    const none = renderVerificationCodeEmail({ ...base, contact: { contactEmail: null, whatsappNumber: null } });
    expect(none.html).not.toContain('mailto:');
    expect(none.html).not.toContain('wa.me');
    expect(none.html).toContain('czdigitizing.example');
  });

  it('uses the configured brand logo from the web app', () => {
    const { html } = renderVerificationCodeEmail(base);
    expect(html).toContain('src="https://czdigitizing.example/brand/logo-horizontal-dark.png"');
    expect(html).toContain('alt="CZ Digitizing"');
  });
});

describe('renderWelcomeEmail', () => {
  const input = { name: 'Ayesha', webBaseUrl: 'https://czdigitizing.example', contact: base.contact };

  it('has the agreed subject, greeting and copy, and no verification code or verify link', () => {
    const email = renderWelcomeEmail(input);

    expect(email.subject).toBe('Welcome to CZ Digitizing — Your Embroidery Design Partner');
    expect(email.html).toContain('Welcome to CZ Digitizing!');
    expect(email.html).toContain('Hello Ayesha,');
    expect(email.html).toContain('Your account has been successfully created');
    expect(email.html).toContain('Thank you for choosing CZ Digitizing.');
    for (const part of [email.html, email.text]) {
      expect(part).not.toMatch(/verification code|verify-email/i);
      // No code anywhere — the © year is the only 4-digit number.
      const year = String(new Date().getFullYear());
      expect(part.split(year).join('')).not.toMatch(/\b\d{4}\b/);
    }
  });

  it('only links to existing apps/web routes', () => {
    const { html } = renderWelcomeEmail(input);
    const hrefs = [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
    const sitePaths = hrefs.filter((h) => h.startsWith('https://czdigitizing.example')).map((h) => h.slice('https://czdigitizing.example'.length));

    expect(new Set(sitePaths)).toEqual(new Set(['', '/designs', '/categories', '/custom-request', '/services/vector-art', '/account']));
  });

  it('footer shows only configured contact and social links; greeting falls back without a name', () => {
    const withSocial = renderWelcomeEmail({
      ...input,
      contact: { ...base.contact, social: [{ label: 'Instagram', url: 'https://instagram.com/czdigitizing' }] },
    });
    expect(withSocial.html).toContain('href="https://instagram.com/czdigitizing"');
    expect(withSocial.html).toContain('mailto:help@czdigitizing.example');

    const bare = renderWelcomeEmail({ ...input, name: null, contact: { contactEmail: null, whatsappNumber: null } });
    expect(bare.html).toContain('Hello,');
    expect(bare.html).not.toContain('mailto:');
    expect(bare.html).not.toContain('wa.me');
    expect(bare.html).not.toContain('instagram');
  });

  it('escapes the display name', () => {
    expect(renderWelcomeEmail({ ...input, name: '<img src=x>' }).html).toContain('Hello &lt;img src=x&gt;,');
  });
});

describe('renderPasswordResetEmail', () => {
  const input = { code: '0731', expiresInMinutes: 10, name: 'Ayesha', webBaseUrl: base.webBaseUrl, contact: base.contact };

  it('keeps the existing subject, shows the code and expiry, and never puts the code in the subject', () => {
    const email = renderPasswordResetEmail(input);

    expect(email.subject).toBe('Reset your CZ Digitizing password');
    expect(email.subject).not.toContain('0731');
    expect(email.html).toContain('Reset Your Password');
    expect(email.html).toContain('Hello Ayesha,');
    expect(email.html).toContain('>0731</div>');
    expect(email.html).toContain('10 minutes');
    expect(email.html).toContain('Your account password will remain unchanged.');
    expect(email.html).toContain('src="https://czdigitizing.example/brand/logo-light.png"');
    expect(/\b(\d{4})\b/.exec(email.text)?.[1]).toBe('0731'); // lastEmailCodeTo contract
  });

  it('has no reset button/link (the flow has none) and links support only to the configured email', () => {
    const email = renderPasswordResetEmail(input);
    expect(email.html).not.toContain('reset-password');
    expect(email.html).toContain('href="mailto:help@czdigitizing.example"');

    const noContact = renderPasswordResetEmail({ ...input, name: null, contact: { contactEmail: null, whatsappNumber: null } });
    expect(noContact.html).toContain('Hello,');
    expect(noContact.html).not.toContain('mailto:');
    expect(noContact.html).toContain('please contact CZ Digitizing support.');
  });

  it('escapes the display name', () => {
    expect(renderPasswordResetEmail({ ...input, name: '<b>x</b>' }).html).toContain('Hello &lt;b&gt;x&lt;/b&gt;,');
  });
});
