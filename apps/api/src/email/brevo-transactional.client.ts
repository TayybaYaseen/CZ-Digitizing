const BREVO_SEND_URL = 'https://api.brevo.com/v3/smtp/email';
const REQUEST_TIMEOUT_MS = 10_000;

export interface BrevoSender {
  email: string;
  name: string;
}

export interface BrevoMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

// Brevo Transactional Email API (POST /v3/smtp/email). Server-side only: the api-key header is set
// here and never logged, returned, or included in a thrown error message.
export class BrevoTransactionalClient {
  constructor(
    private readonly apiKey: string,
    private readonly sender: BrevoSender,
  ) {}

  async send(message: BrevoMessage): Promise<void> {
    const res = await fetch(BREVO_SEND_URL, {
      method: 'POST',
      headers: { 'api-key': this.apiKey, 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({
        sender: this.sender,
        to: [{ email: message.to }],
        subject: message.subject,
        textContent: message.text,
        ...(message.html ? { htmlContent: message.html } : {}),
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!res.ok) {
      const detail = await res.json().then((b) => (b as { message?: string }).message, () => undefined);
      throw new Error(`Brevo send failed (HTTP ${res.status})${detail ? `: ${detail}` : ''}`);
    }
  }
}
