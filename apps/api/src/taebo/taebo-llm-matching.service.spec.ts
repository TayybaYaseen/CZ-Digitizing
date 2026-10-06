import type { KnowledgeItem } from './taebo-knowledge.service';
import { TaeboLlmMatchingService, isGrounded } from './taebo-llm-matching.service';

const KNOWLEDGE: KnowledgeItem[] = [
  { id: 'faq:11', faqId: '11', title: 'What file formats do you provide?', text: 'We provide DST, PES, JEF, EXP and VP3.' },
  { id: 'plan:1', title: 'Subscription plan: Starter Monthly', text: 'PKR 2000 per month, 10 credits per month. See /pricing.' },
  { id: 'contact', title: 'How to contact the CZ Digitizing team', text: 'WhatsApp +92 317 4604508, email czdigitizing@gmail.com, or the Contact page (/contact).' },
];

function createService() {
  const config = { get: (key: string) => (key === 'OPENROUTER_API_KEY' ? 'test-key' : 'test-model') };
  return new TaeboLlmMatchingService(config as never);
}

function mockModelOutput(output: unknown) {
  jest.spyOn(global, 'fetch').mockResolvedValue({
    ok: true,
    json: async () => ({ choices: [{ message: { content: typeof output === 'string' ? output : JSON.stringify(output) } }] }),
  } as Response);
}

afterEach(() => jest.restoreAllMocks());

// AC-7 — the model's output is verified, never trusted: unknown ids, invented numbers/emails/pages
// and fact-carrying "replies" are all discarded (→ keyword fallback / escalation).
describe('TaeboLlmMatchingService.respond', () => {
  it('accepts a grounded answer citing real knowledge', async () => {
    mockModelOutput({ kind: 'answer', answer: 'The Starter Monthly plan is PKR 2,000 per month with 10 credits — see /pricing.', sourceIds: ['plan:1'] });
    expect(await createService().respond('how much is a subscription', [], KNOWLEDGE)).toEqual({
      kind: 'answer',
      answer: 'The Starter Monthly plan is PKR 2,000 per month with 10 credits — see /pricing.',
      sourceIds: ['plan:1'],
    });
  });

  it('strips citation ids the model echoed into the answer text instead of rejecting it', async () => {
    mockModelOutput({ kind: 'answer', answer: 'We provide DST and PES (faq:11). Plans start at PKR 2000 [plan:1].', sourceIds: ['faq:11', 'plan:1'] });
    expect(await createService().respond('formats and price', [], KNOWLEDGE)).toEqual({
      kind: 'answer',
      answer: 'We provide DST and PES. Plans start at PKR 2000.',
      sourceIds: ['faq:11', 'plan:1'],
    });
  });

  it('rejects an answer with a price not in its cited source', async () => {
    mockModelOutput({ kind: 'answer', answer: 'Digitizing costs PKR 1500 per logo.', sourceIds: ['plan:1'] });
    expect(await createService().respond('how much is digitizing?', [], KNOWLEDGE)).toBeNull();
  });

  it('rejects an answer citing an id that was never sent', async () => {
    mockModelOutput({ kind: 'answer', answer: 'We provide DST.', sourceIds: ['faq:999'] });
    expect(await createService().respond('DST?', [], KNOWLEDGE)).toBeNull();
  });

  it('rejects an answer pointing to a page that does not exist', async () => {
    mockModelOutput({ kind: 'answer', answer: 'We provide DST — see /free-downloads.', sourceIds: ['faq:11'] });
    expect(await createService().respond('DST?', [], KNOWLEDGE)).toBeNull();
  });

  it('rejects a "reply" that smuggles in facts', async () => {
    mockModelOutput({ kind: 'reply', answer: 'Hi! Everything is 50% off today.' });
    expect(await createService().respond('hi', [], KNOWLEDGE)).toBeNull();
  });

  it('passes through "unknown" so the caller can escalate', async () => {
    mockModelOutput({ kind: 'unknown', answer: null, sourceIds: [] });
    expect(await createService().respond('do you ship to mars?', [], KNOWLEDGE)).toEqual({ kind: 'unknown' });
  });

  it('passes through "account" for an own-payment/order status question', async () => {
    mockModelOutput({ kind: 'account', answer: null, sourceIds: [] });
    expect(await createService().respond('هل تم تأكيد دفعتي؟', [], KNOWLEDGE)).toEqual({ kind: 'account' });
  });

  it('extracts JSON wrapped in a code fence', async () => {
    mockModelOutput('```json\n{"kind":"reply","answer":"Hello! How can I help?","sourceIds":[]}\n```');
    expect(await createService().respond('hello', [], KNOWLEDGE)).toEqual({ kind: 'reply', answer: 'Hello! How can I help?' });
  });

  it('returns null (never throws) on an HTTP failure', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({ ok: false, status: 429 } as Response);
    expect(await createService().respond('DST?', [], KNOWLEDGE)).toBeNull();
  });

  it('retries once on a transient 429, but not on a client error', async () => {
    const ok = { ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify({ kind: 'reply', answer: 'Hello!' }) } }] }) } as Response;
    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValueOnce({ ok: false, status: 429 } as Response).mockResolvedValueOnce(ok);
    expect(await createService().respond('hello', [], KNOWLEDGE)).toEqual({ kind: 'reply', answer: 'Hello!' });
    expect(fetchSpy).toHaveBeenCalledTimes(2);

    fetchSpy.mockReset().mockResolvedValue({ ok: false, status: 401 } as Response);
    expect(await createService().respond('hello', [], KNOWLEDGE)).toBeNull();
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('sends the conversation history and selected language to the model', async () => {
    mockModelOutput({ kind: 'answer', answer: 'Yes, DST is one of them.', sourceIds: ['faq:11'] });
    await createService().respond('What about DST?', [{ sender: 'customer', message: 'What file formats do you provide?' }], KNOWLEDGE, 'ur');
    const body = JSON.parse((jest.mocked(global.fetch).mock.calls[0][1] as RequestInit).body as string);
    const prompt: string = body.messages[1].content;
    expect(prompt).toContain('Customer: What file formats do you provide?');
    expect(prompt).toContain('Urdu');
    expect(prompt).toContain('What about DST?');
  });
});

describe('isGrounded', () => {
  it('accepts the phone number and email when they come from a cited source', () => {
    expect(isGrounded('WhatsApp us at +92 317 4604508 or email czdigitizing@gmail.com.', [KNOWLEDGE[2]], 'contact?')).toBe(true);
  });

  it('rejects an invented email', () => {
    expect(isGrounded('Email sales@czdigitizing.com.', [KNOWLEDGE[2]], 'contact?')).toBe(false);
  });

  it('allows numbers the customer said themselves', () => {
    expect(isGrounded('I can help with your 3 logos — please use /get-a-quote.', [KNOWLEDGE[0]], 'I have 3 logos')).toBe(true);
  });

  it('does not treat in-word slashes as page paths', () => {
    expect(isGrounded('Monthly/yearly options are on the pricing page.', [KNOWLEDGE[1]], 'plans')).toBe(true);
  });
});
