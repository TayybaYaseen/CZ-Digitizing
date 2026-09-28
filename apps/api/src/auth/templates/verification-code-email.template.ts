import { escapeHtml } from '../../notifications/templates/branded-email.template';

// Branded subject/text/HTML for the customer emails AuthService sends — the login (new-device)
// verification code, the forgot-password code, and the post-registration welcome email. Pure
// rendering only: codes and their TTLs come from the caller, so nothing here touches how codes are
// issued, stored or checked. Sent through the same EmailService as every other email.
//
// Colors are the brand-kit values from apps/web/tailwind.config.ts; the logo is the
// horizontal "dark" lockup apps/web already serves from public/brand/ (it has a baked-in navy
// background, so it sits on a matching dark header band). Layout is table-based with inline styles, which
// is what email clients reliably render; the <style> block only adds mobile tweaks.

export interface VerificationEmailContact {
  contactEmail: string | null;
  whatsappNumber: string | null;
  // Configured social profiles only (Admin → Settings → Social); empty when none are set.
  social?: { label: string; url: string }[];
}

export interface VerificationEmailInput {
  code: string;
  expiresInMinutes: number;
  webBaseUrl: string;
  contact: VerificationEmailContact;
}

export interface RenderedEmail {
  subject: string;
  text: string;
  html: string;
}

const NAVY = '#0B132B';
const GOLD = '#D4AF37';
const GOLD_DARK = '#8A6D1E';
const SLATE = '#4A5568';
const LIGHT_GRAY = '#E5E7EB';
// The logo PNG's own baked-in background — the header band matches it so the image has no visible edge.
const LOGO_BG = '#000B15';

interface Copy {
  subject: string;
  eyebrow: string;
  heading: string;
  intro: string;
  preheader: (expiry: string) => string;
  ignoreNotice: string;
}

const LOGIN_COPY: Copy = {
  subject: 'Your CZ Digitizing login verification code',
  eyebrow: 'Secure sign-in',
  heading: 'Your login verification code',
  intro: 'Use the verification code below to securely sign in to your CZ Digitizing account.',
  preheader: (expiry) => `Use this code to finish signing in to CZ Digitizing. It expires in ${expiry}.`,
  ignoreNotice:
    'If you did not attempt to sign in, you can safely ignore this email and consider reviewing your account security.',
};

// Login (new-device) verification code email.
export function renderVerificationCodeEmail(input: VerificationEmailInput): RenderedEmail {
  const copy = LOGIN_COPY;
  const expiry = `${input.expiresInMinutes} minute${input.expiresInMinutes === 1 ? '' : 's'}`;
  const resetUrl = `${input.webBaseUrl}/forgot-password`;
  return {
    subject: copy.subject,
    text: renderText(input, copy, expiry, resetUrl),
    html: renderHtml(input, copy, expiry, resetUrl),
  };
}

// The code stays the first 4-digit run in the text part — test/integration/auth.spec.ts's
// lastEmailCodeTo helper (and any naive reader) scans for exactly that, so nothing containing
// digits (the footer year, a phone number) may come before it.
function renderText(input: VerificationEmailInput, copy: Copy, expiry: string, resetUrl: string): string {
  const lines = [copy.heading, '', copy.intro, '', `Your verification code: ${input.code}`, '', `This code will expire in ${expiry}.`];
  lines.push('', copy.ignoreNotice, `Reset your password: ${resetUrl}`);
  lines.push('', '—', 'CZ Digitizing · Machine Embroidery Digitizing', input.webBaseUrl);
  if (input.contact.contactEmail) lines.push(`Email: ${input.contact.contactEmail}`);
  if (input.contact.whatsappNumber) lines.push(`WhatsApp: ${input.contact.whatsappNumber}`);
  return lines.join('\n');
}

function renderHtml(input: VerificationEmailInput, copy: Copy, expiry: string, resetUrl: string): string {
  const e = escapeHtml;
  const logoUrl = `${input.webBaseUrl}/brand/logo-horizontal-dark.png`;

  // Highlighted security panel, with a way to act on it.
  const noticeBlock = `<tr>
                <td style="padding:28px 0 0;">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="background:#FBF8EE;border-left:4px solid ${GOLD};border-radius:6px;padding:16px 18px;font-size:13px;line-height:1.6;color:${SLATE};">
                        <strong style="color:${NAVY};">Didn&#39;t try to sign in?</strong><br>
                        ${e(copy.ignoreNotice)}
                        <a href="${e(resetUrl)}" style="color:${GOLD_DARK};font-weight:bold;">Reset your password</a>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>`;

  const contactLinks = [
    `<a href="${e(input.webBaseUrl)}" style="color:${SLATE};text-decoration:underline;">${e(displayHost(input.webBaseUrl))}</a>`,
    input.contact.contactEmail
      ? `<a href="mailto:${e(input.contact.contactEmail)}" style="color:${SLATE};text-decoration:underline;">${e(input.contact.contactEmail)}</a>`
      : null,
    input.contact.whatsappNumber
      ? `<a href="https://wa.me/${input.contact.whatsappNumber.replace(/[^\d]/g, '')}" style="color:${SLATE};text-decoration:underline;">WhatsApp ${e(input.contact.whatsappNumber)}</a>`
      : null,
  ].filter(Boolean);

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="color-scheme" content="light">
    <meta name="supported-color-schemes" content="light">
    <title>${e(copy.subject)}</title>
    <style>
      @media only screen and (max-width: 600px) {
        .czd-outer { padding: 12px 8px !important; }
        .czd-body { padding: 28px 20px !important; }
        .czd-footer { padding: 20px !important; }
        .czd-code { font-size: 30px !important; letter-spacing: 6px !important; }
        .czd-heading { font-size: 22px !important; }
      }
    </style>
  </head>
  <body style="margin:0;padding:0;background:#EEF0F4;-webkit-text-size-adjust:100%;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${e(copy.preheader(expiry))}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#EEF0F4;">
      <tr>
        <td align="center" class="czd-outer" style="padding:32px 16px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid ${LIGHT_GRAY};border-radius:12px;overflow:hidden;font-family:Arial,Helvetica,sans-serif;">
            <tr>
              <td align="center" style="background:${LOGO_BG};padding:24px 24px 20px;">
                <img src="${e(logoUrl)}" width="246" height="46" alt="CZ Digitizing" style="display:block;border:0;outline:none;width:246px;max-width:100%;height:auto;color:#ffffff;font-size:20px;font-weight:bold;font-family:Georgia,'Times New Roman',serif;">
              </td>
            </tr>
            <tr>
              <td style="background:${GOLD};height:4px;line-height:4px;font-size:0;">&nbsp;</td>
            </tr>
            <tr>
              <td class="czd-body" style="padding:40px 44px 36px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="font-size:12px;font-weight:bold;letter-spacing:1.5px;text-transform:uppercase;color:${GOLD_DARK};padding:0 0 10px;">${e(copy.eyebrow)}</td>
                  </tr>
                  <tr>
                    <td class="czd-heading" style="font-family:'Playfair Display',Georgia,'Times New Roman',serif;font-size:26px;line-height:1.3;font-weight:bold;color:${NAVY};padding:0 0 14px;">${e(copy.heading)}</td>
                  </tr>
                  <tr>
                    <td style="font-size:15px;line-height:1.65;color:${SLATE};padding:0 0 28px;">${e(copy.intro)}</td>
                  </tr>
                  <tr>
                    <td align="center" style="background:#F8F6EF;border:1px solid #E9DFBF;border-radius:10px;padding:22px 16px;">
                      <div style="font-size:11px;font-weight:bold;letter-spacing:1.5px;text-transform:uppercase;color:${SLATE};padding:0 0 10px;">Your verification code</div>
                      <div class="czd-code" style="font-family:'SFMono-Regular',Consolas,'Liberation Mono',Menlo,'Courier New',monospace;font-size:38px;line-height:1.2;font-weight:bold;letter-spacing:10px;color:${NAVY};-webkit-user-select:all;user-select:all;">${e(input.code)}</div>
                    </td>
                  </tr>
                  <tr>
                    <td align="center" style="padding:16px 0 0;font-size:14px;line-height:1.5;color:${SLATE};">This code will expire in <strong style="color:${NAVY};">${e(expiry)}</strong>.</td>
                  </tr>
                  ${noticeBlock}
                </table>
              </td>
            </tr>
            <tr>
              <td class="czd-footer" align="center" style="background:#F7F8FA;border-top:1px solid ${LIGHT_GRAY};padding:24px 32px;font-size:12px;line-height:1.7;color:#6B7280;">
                <div style="font-family:'Playfair Display',Georgia,'Times New Roman',serif;font-size:15px;font-weight:bold;color:${NAVY};">CZ Digitizing</div>
                <div style="padding:0 0 8px;">Machine Embroidery Digitizing &amp; Designs</div>
                <div>${contactLinks.join(' &nbsp;&middot;&nbsp; ')}</div>
                <div style="padding:10px 0 0;color:#9CA3AF;">This is an automated security message. &copy; ${new Date().getFullYear()} CZ Digitizing. All rights reserved.</div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

// --- Forgot-password email ---
//
// Same inputs the plain-text version always had (the code and its TTL), plus the recipient's
// display name for the greeting and the configured contact email for the support line. The
// forgot-password flow has no reset link — the customer types the code on /reset-password — so
// there is deliberately no button here.

export interface PasswordResetEmailInput {
  code: string;
  expiresInMinutes: number;
  name: string | null;
  webBaseUrl: string;
  contact: VerificationEmailContact;
}

// logo-light.png's own off-white background, matched by the header band so the image has no
// visible edge. The file also carries a 6px dark band down its right edge; the header clips it
// with a slightly narrower overflow:hidden box rather than shipping an edited copy of the logo.
const LOGO_LIGHT_BG = '#F4F4F3';
const LOGO_LIGHT_WIDTH = 190; // of the 378x232 source — height follows at 117px
const LOGO_LIGHT_CLIP = 184; // the band starts at 372/378 (~187px); a few px of margin for scaling blur

export function renderPasswordResetEmail(input: PasswordResetEmailInput): RenderedEmail {
  const e = escapeHtml;
  const subject = 'Reset your CZ Digitizing password';
  const expiry = `${input.expiresInMinutes} minute${input.expiresInMinutes === 1 ? '' : 's'}`;
  const greeting = input.name?.trim() ? `Hello ${input.name.trim()},` : 'Hello,';
  const intro = 'We received a request to reset the password for your CZ Digitizing account.';
  const securityNotice =
    'If you did not request a password reset, you can safely ignore this email. Your account password will remain unchanged.';
  const year = new Date().getFullYear();
  const supportEmail = input.contact.contactEmail;

  const text = [
    'Reset Your Password',
    '',
    greeting,
    '',
    intro,
    '',
    `Your verification code: ${input.code}`,
    '',
    'Enter this code on the password reset page to continue.',
    `This code will expire in ${expiry}.`,
    '',
    securityNotice,
    '',
    supportEmail ? `If you need help, please contact CZ Digitizing support at ${supportEmail}.` : 'If you need help, please contact CZ Digitizing support.',
    '',
    '—',
    'CZ Digitizing',
    'Machine Embroidery Designs',
    `© ${year} CZ Digitizing. All rights reserved.`,
  ].join('\n');

  const supportHtml = supportEmail
    ? `If you need help, please contact <a href="mailto:${e(supportEmail)}" style="color:${NAVY};font-weight:bold;text-decoration:underline;">CZ Digitizing support</a>.`
    : 'If you need help, please contact CZ Digitizing support.';

  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="color-scheme" content="light">
    <meta name="supported-color-schemes" content="light">
    <title>${e(subject)}</title>
    <style>
      @media only screen and (max-width: 620px) {
        .czd-outer { padding: 16px 10px !important; }
        .czd-body { padding: 32px 22px !important; }
        .czd-footer { padding: 22px !important; }
        .czd-code { font-size: 32px !important; letter-spacing: 8px !important; }
        .czd-heading { font-size: 24px !important; }
      }
    </style>
  </head>
  <body style="margin:0;padding:0;background:#F1F2F5;-webkit-text-size-adjust:100%;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${e(`Use this code to reset your CZ Digitizing password. It expires in ${expiry}.`)}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F1F2F5;">
      <tr>
        <td align="center" class="czd-outer" style="padding:40px 16px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border:1px solid ${LIGHT_GRAY};border-radius:14px;overflow:hidden;box-shadow:0 4px 18px rgba(11,19,43,0.06);font-family:Arial,Helvetica,sans-serif;">
            ${lightLogoHeaderRows(input.webBaseUrl)}
            <tr>
              <td class="czd-body" style="padding:44px 52px 40px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td class="czd-heading" style="font-family:'Playfair Display',Georgia,'Times New Roman',serif;font-size:28px;line-height:1.3;font-weight:bold;color:${NAVY};padding:0 0 22px;">Reset Your Password</td>
                  </tr>
                  <tr>
                    <td style="font-size:15px;line-height:1.65;color:#1F2937;padding:0 0 10px;">${e(greeting)}</td>
                  </tr>
                  <tr>
                    <td style="font-size:15px;line-height:1.65;color:${SLATE};padding:0 0 28px;">${e(intro)}</td>
                  </tr>
                  <tr>
                    <td align="center" style="background:#F8F6EF;border:1px solid #E9DFBF;border-radius:12px;padding:26px 16px 24px;">
                      <div style="font-size:11px;font-weight:bold;letter-spacing:1.6px;text-transform:uppercase;color:${GOLD_DARK};padding:0 0 12px;">Your verification code</div>
                      <div class="czd-code" style="font-family:'SFMono-Regular',Consolas,'Liberation Mono',Menlo,'Courier New',monospace;font-size:40px;line-height:1.2;font-weight:bold;letter-spacing:12px;color:${NAVY};-webkit-user-select:all;user-select:all;">${e(input.code)}</div>
                      <div style="font-size:13px;line-height:1.5;color:${SLATE};padding:14px 0 0;">Enter this code on the password reset page to continue.</div>
                    </td>
                  </tr>
                  <tr>
                    <td align="center" style="padding:16px 0 0;font-size:14px;line-height:1.5;color:${SLATE};">This code will expire in <strong style="color:${NAVY};">${e(expiry)}</strong>.</td>
                  </tr>
                  <tr>
                    <td style="padding:30px 0 0;">
                      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                        <tr>
                          <td style="background:#F7F8FA;border:1px solid ${LIGHT_GRAY};border-left:4px solid ${GOLD};border-radius:8px;padding:16px 18px;font-size:13px;line-height:1.6;color:${SLATE};">
                            <strong style="color:${NAVY};">Didn&#39;t request this?</strong><br>
                            ${e(securityNotice)}
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:24px 0 0;font-size:14px;line-height:1.6;color:${SLATE};">${supportHtml}</td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td class="czd-footer" align="center" style="background:#F7F8FA;border-top:1px solid ${LIGHT_GRAY};padding:26px 32px;font-size:12px;line-height:1.7;color:#6B7280;">
                <div style="font-family:'Playfair Display',Georgia,'Times New Roman',serif;font-size:15px;font-weight:bold;color:${NAVY};">CZ Digitizing</div>
                <div>Machine Embroidery Designs</div>
                <div style="padding:10px 0 0;color:#9CA3AF;">&copy; ${year} CZ Digitizing. All rights reserved.</div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  return { subject, text, html };
}

// Light header band with the approved logo + thin gold rule — shared by the reset and welcome emails.
function lightLogoHeaderRows(webBaseUrl: string): string {
  return `<tr>
              <td align="center" style="background:${LOGO_LIGHT_BG};padding:22px 24px 18px;border-bottom:1px solid ${LIGHT_GRAY};">
                <div style="width:${LOGO_LIGHT_CLIP}px;max-width:100%;overflow:hidden;margin:0 auto;">
                  <img src="${escapeHtml(`${webBaseUrl}/brand/logo-light.png`)}" width="${LOGO_LIGHT_WIDTH}" alt="CZ Digitizing" style="display:block;border:0;outline:none;width:${LOGO_LIGHT_WIDTH}px;height:auto;color:${NAVY};font-size:20px;font-weight:bold;font-family:Georgia,'Times New Roman',serif;">
                </div>
              </td>
            </tr>
            <tr>
              <td style="background:${GOLD};height:3px;line-height:3px;font-size:0;">&nbsp;</td>
            </tr>`;
}

// --- Welcome email (sent right after registration) ---
//
// Every link points at an existing apps/web route (checked against apps/web/app/): /designs,
// /categories, /custom-request, /account, and the Vector Art service page. That last one is the
// admin-managed service slug "vector-art" — there is no separate vector-design catalog, so the copy
// and button say "Vector Art" rather than promising a vector product listing.

export interface WelcomeEmailInput {
  name: string | null;
  webBaseUrl: string;
  contact: VerificationEmailContact;
}

interface WelcomeService {
  title: string;
  body: string;
  linkLabel: string;
  path: string;
}

const WELCOME_SERVICES: WelcomeService[] = [
  {
    title: 'Custom Logo Design & Embroidery',
    body: 'Turn your logo into a professional machine embroidery design, prepared according to your required size, fabric, and machine format. Send us a custom logo embroidery request any time.',
    linkLabel: 'Request a custom logo',
    path: '/custom-request',
  },
  {
    title: 'All Embroidery File Formats',
    body: 'Get your embroidery designs in the file format you need for your machine. The formats available for each design are listed on its product page.',
    linkLabel: 'Explore designs',
    path: '/designs',
  },
  {
    title: 'Vector Designs',
    body: 'Explore professional vector artwork for printing, branding, and other creative applications.',
    linkLabel: 'Explore vector art',
    path: '/services/vector-art',
  },
  {
    title: 'Buy Embroidery Designs & Logos',
    body: 'Browse our design collection and purchase ready-made embroidery designs and logo designs directly from CZ Digitizing.',
    linkLabel: 'Browse categories',
    path: '/categories',
  },
];

const WELCOME_BENEFITS = [
  'Explore embroidery designs',
  'Purchase ready-made designs',
  'Request custom logo embroidery',
  'Find suitable embroidery file formats',
  'Explore vector designs',
  'Manage your account and purchases',
];

export function renderWelcomeEmail(input: WelcomeEmailInput): RenderedEmail {
  const e = escapeHtml;
  const subject = 'Welcome to CZ Digitizing — Your Embroidery Design Partner';
  const greeting = input.name?.trim() ? `Hello ${input.name.trim()},` : 'Hello,';
  const year = new Date().getFullYear();
  const url = (path: string) => `${input.webBaseUrl}${path}`;
  const intro1 = "Welcome to CZ Digitizing! We're glad to have you with us.";
  const intro2 =
    "Your account has been successfully created, and you're now ready to explore professional embroidery and vector design solutions for your projects.";

  const ctas = [
    { label: 'Explore Designs', path: '/designs', primary: true },
    { label: 'Custom Logo Request', path: '/custom-request', primary: true },
    { label: 'Explore Vector Art', path: '/services/vector-art', primary: false },
    { label: 'Visit CZ Digitizing', path: '', primary: false },
  ];

  const footerLinks = [
    { label: displayHost(input.webBaseUrl), href: input.webBaseUrl },
    input.contact.contactEmail ? { label: input.contact.contactEmail, href: `mailto:${input.contact.contactEmail}` } : null,
    input.contact.whatsappNumber
      ? { label: `WhatsApp ${input.contact.whatsappNumber}`, href: `https://wa.me/${input.contact.whatsappNumber.replace(/[^\d]/g, '')}` }
      : null,
  ].filter((link): link is { label: string; href: string } => !!link);
  const social = input.contact.social ?? [];

  const text = [
    'Welcome to CZ Digitizing!',
    '',
    greeting,
    '',
    intro1,
    '',
    intro2,
    '',
    'WHAT YOU CAN DO',
    ...WELCOME_SERVICES.flatMap((s) => ['', s.title, s.body, `${s.linkLabel}: ${url(s.path)}`]),
    '',
    'WITH YOUR ACCOUNT YOU CAN',
    ...WELCOME_BENEFITS.map((b) => `- ${b}`),
    `My account: ${url('/account')}`,
    '',
    'Thank you for choosing CZ Digitizing.',
    'We look forward to helping you bring your designs to life.',
    '',
    'Regards,',
    'CZ Digitizing',
    'Machine Embroidery Designs',
    '',
    '—',
    input.webBaseUrl,
    ...(input.contact.contactEmail ? [`Email: ${input.contact.contactEmail}`] : []),
    ...(input.contact.whatsappNumber ? [`WhatsApp: ${input.contact.whatsappNumber}`] : []),
    ...social.map((s) => `${s.label}: ${s.url}`),
    `© ${year} CZ Digitizing. All rights reserved.`,
  ].join('\n');

  const serviceCard = (s: WelcomeService) => `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FAFAF7;border:1px solid ${LIGHT_GRAY};border-top:3px solid ${GOLD};border-radius:10px;">
                          <tr>
                            <td style="padding:20px 20px 18px;">
                              <div style="font-family:'Playfair Display',Georgia,'Times New Roman',serif;font-size:17px;line-height:1.35;font-weight:bold;color:${NAVY};padding:0 0 8px;">${e(s.title)}</div>
                              <div style="font-size:13.5px;line-height:1.6;color:${SLATE};padding:0 0 12px;">${e(s.body)}</div>
                              <a href="${e(url(s.path))}" style="font-size:13px;font-weight:bold;color:${GOLD_DARK};text-decoration:none;">${e(s.linkLabel)} &rarr;</a>
                            </td>
                          </tr>
                        </table>`;

  const serviceRows = [0, 2]
    .map(
      (i) => `<tr>
                      <td class="czd-col" width="50%" valign="top" style="padding:0 6px 12px 0;">
                        ${serviceCard(WELCOME_SERVICES[i])}
                      </td>
                      <td class="czd-col" width="50%" valign="top" style="padding:0 0 12px 6px;">
                        ${serviceCard(WELCOME_SERVICES[i + 1])}
                      </td>
                    </tr>`,
    )
    .join('');

  // Buttons sit on the navy "Explore" panel: gold-filled primaries, outlined secondaries.
  const ctaButton = (c: (typeof ctas)[number]) =>
    c.primary
      ? `<a href="${e(url(c.path))}" style="display:block;background:${GOLD};color:${NAVY};text-decoration:none;font-size:14px;font-weight:bold;text-align:center;padding:13px 16px;border-radius:8px;">${e(c.label)}</a>`
      : `<a href="${e(url(c.path))}" style="display:block;color:#ffffff;text-decoration:none;font-size:14px;font-weight:bold;text-align:center;padding:12px 16px;border:1px solid #CBD5E0;border-radius:8px;">${e(c.label)}</a>`;

  const ctaRows = [0, 2]
    .map(
      (i) => `<tr>
                      <td class="czd-col" width="50%" style="padding:0 6px 12px 0;">${ctaButton(ctas[i])}</td>
                      <td class="czd-col" width="50%" style="padding:0 0 12px 6px;">${ctaButton(ctas[i + 1])}</td>
                    </tr>`,
    )
    .join('');

  const benefitRows = WELCOME_BENEFITS.map(
    (b) => `<tr>
                      <td width="22" valign="top" style="font-size:15px;line-height:1.6;color:${GOLD};font-weight:bold;">&bull;</td>
                      <td style="font-size:14px;line-height:1.6;color:#1F2937;padding:0 0 4px;">${e(b)}</td>
                    </tr>`,
  ).join('');

  const footerLinkHtml = [...footerLinks, ...social.map((s) => ({ label: s.label, href: s.url }))]
    .map((l) => `<a href="${e(l.href)}" style="color:${SLATE};text-decoration:underline;">${e(l.label)}</a>`)
    .join(' &nbsp;&middot;&nbsp; ');

  const sectionHeading = (label: string) =>
    `<div style="font-size:12px;font-weight:bold;letter-spacing:1.6px;text-transform:uppercase;color:${GOLD_DARK};padding:0 0 14px;">${e(label)}</div>`;

  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="color-scheme" content="light">
    <meta name="supported-color-schemes" content="light">
    <title>${e(subject)}</title>
    <style>
      @media only screen and (max-width: 620px) {
        .czd-outer { padding: 16px 10px !important; }
        .czd-body { padding: 32px 22px !important; }
        .czd-footer { padding: 22px !important; }
        .czd-heading { font-size: 26px !important; }
        .czd-col { display: block !important; width: 100% !important; padding: 0 0 12px 0 !important; }
      }
    </style>
  </head>
  <body style="margin:0;padding:0;background:#F1F2F5;-webkit-text-size-adjust:100%;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">Your CZ Digitizing account is ready. Explore embroidery designs, custom logo digitizing and vector art.</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F1F2F5;">
      <tr>
        <td align="center" class="czd-outer" style="padding:40px 16px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border:1px solid ${LIGHT_GRAY};border-radius:14px;overflow:hidden;box-shadow:0 4px 18px rgba(11,19,43,0.06);font-family:Arial,Helvetica,sans-serif;">
            ${lightLogoHeaderRows(input.webBaseUrl)}
            <tr>
              <td class="czd-body" style="padding:44px 48px 12px;">
                <div style="font-size:12px;font-weight:bold;letter-spacing:1.6px;text-transform:uppercase;color:${GOLD_DARK};padding:0 0 10px;">Account created</div>
                <div class="czd-heading" style="font-family:'Playfair Display',Georgia,'Times New Roman',serif;font-size:30px;line-height:1.25;font-weight:bold;color:${NAVY};padding:0 0 22px;">Welcome to CZ Digitizing!</div>
                <div style="font-size:15px;line-height:1.65;color:#1F2937;padding:0 0 10px;">${e(greeting)}</div>
                <div style="font-size:15px;line-height:1.65;color:${SLATE};padding:0 0 12px;">${e(intro1)}</div>
                <div style="font-size:15px;line-height:1.65;color:${SLATE};padding:0 0 8px;">${e(intro2)}</div>
              </td>
            </tr>
            <tr>
              <td class="czd-body" style="padding:24px 48px 8px;">
                ${sectionHeading('What you can do')}
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  ${serviceRows}
                </table>
              </td>
            </tr>
            <tr>
              <td class="czd-body" style="padding:16px 48px 8px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${NAVY};border-radius:12px;">
                  <tr>
                    <td style="padding:26px 24px 14px;">
                      <div style="font-family:'Playfair Display',Georgia,'Times New Roman',serif;font-size:20px;font-weight:bold;color:#ffffff;padding:0 0 6px;text-align:center;">Explore CZ Digitizing</div>
                      <div style="font-size:13.5px;line-height:1.6;color:#CBD5E0;padding:0 0 18px;text-align:center;">Start with the collection, or tell us about your own logo.</div>
                      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                        ${ctaRows}
                      </table>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td class="czd-body" style="padding:28px 48px 8px;">
                ${sectionHeading('With your account you can')}
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  ${benefitRows}
                </table>
                <div style="padding:10px 0 0;"><a href="${e(url('/account'))}" style="font-size:13px;font-weight:bold;color:${GOLD_DARK};text-decoration:none;">Go to my account &rarr;</a></div>
              </td>
            </tr>
            <tr>
              <td class="czd-body" style="padding:28px 48px 40px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid ${LIGHT_GRAY};">
                  <tr>
                    <td style="padding:26px 0 0;font-size:15px;line-height:1.65;color:${SLATE};">
                      Thank you for choosing CZ Digitizing.<br>
                      We look forward to helping you bring your designs to life.
                      <div style="padding:18px 0 0;color:#1F2937;">Regards,</div>
                      <div style="font-family:'Playfair Display',Georgia,'Times New Roman',serif;font-size:16px;font-weight:bold;color:${NAVY};padding:2px 0 0;">CZ Digitizing</div>
                      <div style="font-size:13px;color:${SLATE};">Machine Embroidery Designs</div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td class="czd-footer" align="center" style="background:#F7F8FA;border-top:1px solid ${LIGHT_GRAY};padding:26px 32px;font-size:12px;line-height:1.7;color:#6B7280;">
                <div style="font-family:'Playfair Display',Georgia,'Times New Roman',serif;font-size:15px;font-weight:bold;color:${NAVY};">CZ Digitizing</div>
                <div style="padding:0 0 8px;">Machine Embroidery Designs</div>
                <div>${footerLinkHtml}</div>
                <div style="padding:10px 0 0;color:#9CA3AF;">&copy; ${year} CZ Digitizing. All rights reserved.</div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  return { subject, text, html };
}

function displayHost(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}
