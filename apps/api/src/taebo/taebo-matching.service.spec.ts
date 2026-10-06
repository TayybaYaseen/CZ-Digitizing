import type { FaqDto } from '@czd/shared-types';
import type { KnowledgeItem } from './taebo-knowledge.service';
import type { LlmResponse } from './taebo-llm-matching.service';
import { TaeboMatchingService } from './taebo-matching.service';

function makeFaq(overrides: Partial<FaqDto> = {}): FaqDto {
  return {
    id: '1',
    question: 'What file formats do you support?',
    answer: 'We support DST, PES, and more.',
    topic: 'formats',
    relatedPage: null,
    relatedService: null,
    relatedCategory: null,
    languageCode: 'en',
    priority: 0,
    taeboVisible: true,
    isPublished: true,
    helpfulYesCount: 0,
    helpfulNoCount: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function createFakeKnowledge(faqs: FaqDto[], extra: KnowledgeItem[] = []) {
  const items: KnowledgeItem[] = [...faqs.map((f) => ({ id: `faq:${f.id}`, title: f.question, text: f.answer, faqId: f.id })), ...extra];
  return { load: jest.fn(async () => ({ faqs, items })) };
}

// Unconfigured by default (isConfigured: false) so the keyword-matcher tests exercise the local
// matcher unchanged; the LLM-specific tests below override this.
function createFakeLlm(overrides: { isConfigured?: boolean; respond?: () => Promise<LlmResponse | null> } = {}) {
  return {
    isConfigured: jest.fn(() => overrides.isConfigured ?? false),
    respond: jest.fn(overrides.respond ?? (async () => null)),
  };
}

function service(faqs: FaqDto[], llm = createFakeLlm()) {
  return new TaeboMatchingService(createFakeKnowledge(faqs) as never, llm as never);
}

function ask(svc: TaeboMatchingService, message: string, history: { sender: 'customer' | 'taebo'; message: string }[] = []) {
  return svc.resolve({ message, history });
}

// The live taebo_visible=true FAQ set (apps/api/scripts/seed-content.ts) — short-query behaviour is
// only meaningful against realistic content, where common words appear in many answers.
const SEED_FAQS: FaqDto[] = [
  makeFaq({ id: '9', topic: 'General Website', question: 'What is CZ Digitizing?', answer: 'CZ Digitizing is an international e-commerce and service website for machine embroidery designs, professional embroidery digitizing, vector art conversion, subscriptions, credits, and custom quotes — with 10+ years of embroidery experience behind every order.' }),
  makeFaq({ id: '11', topic: 'Embroidery Designs', question: 'What machine embroidery file formats do you provide?', answer: 'Depending on the design, we provide up to 5 supported machine formats — DST, PES, JEF, EXP and VP3 — plus an optional ZIP containing every purchased format for that design.' }),
  makeFaq({ id: '17', topic: 'Cart/Checkout', question: 'How does checkout work?', answer: 'Add designs or bundles to your cart, choose a size where required, review your subtotal/discount/total on the Cart page, then proceed to Checkout to choose a payment method and complete your order. Your cart icon always shows a live item-count badge.' }),
  makeFaq({ id: '19', topic: 'Payments', question: 'What payment methods do you accept?', answer: 'We accept Bank Transfer only. After checkout you transfer the exact amount in PKR to our bank account (shown on the payment page), then upload your payment receipt. We review it and confirm your payment before releasing your files — you will be notified either way.' }),
  makeFaq({ id: '20', topic: 'Downloads', question: 'When can I download my purchased files?', answer: 'Files are released for download once your payment is confirmed — that is, once our team verifies the bank-transfer receipt you uploaded. Every download is logged against your account.' }),
  makeFaq({ id: '25', topic: 'Pricing/Credits', question: 'What is the difference between a subscription and buying credits?', answer: 'A subscription (Starter, Professional or Business) gives you recurring monthly credits and perks like priority support at a fixed monthly/yearly price. Credit packages let you buy a one-time block of credits (e.g. 25, 50 or 100) with no subscription required. Both can be used toward eligible purchases.' }),
  makeFaq({ id: '31', topic: 'Contact/Support', question: 'How can I contact CZ Digitizing directly?', answer: 'WhatsApp us at +92 317 4604508, email czdigitizing@gmail.com, use the Contact form, or reach us on Facebook, Instagram or LinkedIn — all links are on our Contact page and footer.' }),
  makeFaq({ id: '33', topic: 'Privacy/Security', question: 'Do you ever share or expose my private files or payment details?', answer: 'No. Private embroidery files are never publicly browsable, direct storage URLs are never exposed, and sensitive payment details (card numbers, bank credentials, OTPs) are never stored or shown in plain form. Every private-file download requires a verified purchase.' }),
];

// docs/specs/2026-08-28-15-taebo-chatbot.md AC-2/AC-3/AC-7 — only returns an answer when confidence
// clears the deliberately conservative bar; never guesses on an unrelated question; the LLM path
// (AC-7) is tried first when configured but always falls back to the local keyword matcher on any
// failure or no-answer, never surfacing an error.
describe('TaeboMatchingService', () => {
  describe('keyword matcher', () => {
    it('matches a question that overlaps meaningfully with an FAQ', async () => {
      const result = await ask(service([makeFaq({ id: '1' })]), 'What file formats are supported?');
      expect(result).toEqual(expect.objectContaining({ type: 'answer', faqId: '1' }));
    });

    it('matches a longer, differently-worded customer question against a short FAQ question (stemming + min-size scoring)', async () => {
      const result = await ask(service([makeFaq({ id: '1' })]), 'Hi there, I was wondering which embroidery file formats you are able to support for my project?');
      expect(result).toEqual(expect.objectContaining({ type: 'answer', faqId: '1' }));
    });

    it('matches via the answer text when the question wording shares nothing with the FAQ question but strongly overlaps the answer', async () => {
      const faqs = [makeFaq({ id: '1', question: 'More details', topic: 'info', answer: 'We offer embroidery designs in multiple standard sizes such as 4x4, 5x7, and 6x10 inches.' })];
      const result = await ask(service(faqs), 'What standard sizes do you offer for embroidery designs?');
      expect(result).toEqual(expect.objectContaining({ type: 'answer', faqId: '1' }));
    });

    it('does not match via the answer text when overlap is only partial (answer channel needs a higher bar)', async () => {
      const faqs = [makeFaq({ id: '1', question: 'More details', topic: 'info', answer: 'We offer embroidery designs in multiple standard sizes such as 4x4, 5x7, and 6x10 inches.' })];
      expect(await ask(service(faqs), 'Do you have any discounts on bulk orders?')).toBeNull();
    });

    it('matches word-family variants via fuzzy prefix ("customize" against "custom")', async () => {
      const faqs = [makeFaq({ id: '1', question: 'Do you offer custom design services?', topic: 'custom-design', answer: 'Yes! We offer custom embroidery digitizing and custom vector art design tailored to your requirements.' })];
      const result = await ask(service(faqs), 'Would you design customize?');
      expect(result).toEqual(expect.objectContaining({ type: 'answer', faqId: '1' }));
    });

    it('does not fuzzy-match short unrelated words', async () => {
      expect(await ask(service([makeFaq({ id: '1', question: 'Do you have a cat mascot?', topic: 'misc' })]), 'Can I rent a car?')).toBeNull();
    });

    it('returns null when no FAQ meaningfully overlaps (AC-3: never guess)', async () => {
      expect(await ask(service([makeFaq({ id: '1' })]), 'Do you ship internationally?')).toBeNull();
    });

    it('returns null when there are no taebo-visible candidates at all', async () => {
      expect(await ask(service([]), 'What file formats do you support?')).toBeNull();
    });

    it.each([
      ['what file formts do you provide', '11'],
      ['how do i contakt you on whatsap', '31'],
      ['diffrence between subscripton and credits', '25'],
    ])('tolerates spelling mistakes: %p', async (message, faqId) => {
      expect(await ask(service(SEED_FAQS), message)).toEqual(expect.objectContaining({ type: 'answer', faqId }));
    });
  });

  describe('short queries', () => {
    it.each([
      ['DST?', '11'],
      ['formats?', '11'],
      ['whatsapp?', '31'],
      ['checkout?', '17'],
      ['subscription?', '25'],
      ['price?', '25'],
    ])('answers a one-word question that only one FAQ is about: %p', async (message, faqId) => {
      expect(await ask(service(SEED_FAQS), message)).toEqual(expect.objectContaining({ type: 'answer', faqId }));
    });

    it.each(['order?', 'payment?', 'design?'])('asks "did you mean" instead of guessing when several FAQs fit: %p', async (message) => {
      const result = await ask(service(SEED_FAQS), message);
      expect(result?.type).toBe('clarify');
      if (result?.type === 'clarify') {
        expect(result.options.length).toBeGreaterThan(1);
        expect(result.options.length).toBeLessThanOrEqual(3);
      }
    });

    it.each(['yes', 'no', 'help', 'how much?', 'logo?', 'quote?', 'cost?'])(
      'never false-matches a filler-only or uncovered short query: %p',
      async (message) => {
        expect(await ask(service(SEED_FAQS), message)).toBeNull();
      },
    );
  });

  describe('follow-up questions', () => {
    it('reads a short follow-up together with the previous question', async () => {
      const faqs = [
        makeFaq({ id: '1', question: 'Do you offer custom logo digitizing?', topic: 'custom', answer: 'Yes, send your logo through a Custom Request.' }),
        makeFaq({ id: '2', question: 'How long does custom logo digitizing take?', topic: 'custom turnaround', answer: 'Turnaround is listed on your request.' }),
        makeFaq({ id: '3', question: 'How long does shipping take for bundles?', topic: 'bundles', answer: 'Bundles are digital.' }),
      ];
      const result = await ask(service(faqs), 'how long does it take?', [
        { sender: 'customer', message: 'Do you do custom logo digitizing?' },
        { sender: 'taebo', message: 'Yes, send your logo through a Custom Request.' },
      ]);
      expect(result).toEqual(expect.objectContaining({ type: 'answer', faqId: '2' }));
    });

    it('does not re-answer the previous question when the follow-up adds nothing that FAQ covers', async () => {
      const result = await ask(service(SEED_FAQS), 'and refunds?', [{ sender: 'customer', message: 'What payment methods do you accept?' }]);
      expect(result).toBeNull();
    });
  });

  describe('LLM path (AC-7)', () => {
    it('returns a verified LLM answer and reports its FAQ source', async () => {
      const llm = createFakeLlm({ isConfigured: true, respond: async () => ({ kind: 'answer', answer: 'We provide DST, PES and more.', sourceIds: ['faq:11'] }) });
      const result = await ask(service(SEED_FAQS, llm), 'Completely unrelated phrasing the keyword matcher would reject');
      expect(result).toEqual({ type: 'answer', answer: 'We provide DST, PES and more.', faqId: '11' });
    });

    it('passes the conversation history to the LLM', async () => {
      const llm = createFakeLlm({ isConfigured: true, respond: async () => ({ kind: 'reply', answer: 'Sure — which design?' }) });
      const history = [{ sender: 'customer' as const, message: 'What file formats do you provide?' }];
      const result = await ask(service(SEED_FAQS, llm), 'What about DST?', history);
      expect(llm.respond).toHaveBeenCalledWith('What about DST?', history, expect.any(Array), undefined);
      expect(result).toEqual({ type: 'reply', answer: 'Sure — which design?' });
    });

    it('escalates an account-specific question the LLM flags (any language) without keyword matching', async () => {
      const llm = createFakeLlm({ isConfigured: true, respond: async () => ({ kind: 'account' }) });
      const result = await ask(service(SEED_FAQS, llm), 'هل تم تأكيد دفعتي؟');
      expect(result).toEqual({ type: 'account' });
    });

    it.each([null, { kind: 'unknown' } as const])('falls back to the keyword matcher when the LLM returns %p', async (llmResult) => {
      const llm = createFakeLlm({ isConfigured: true, respond: async () => llmResult });
      const result = await ask(service([makeFaq({ id: '1' })], llm), 'What file formats are supported?');
      expect(result).toEqual(expect.objectContaining({ type: 'answer', faqId: '1' }));
      expect(llm.respond).toHaveBeenCalled();
    });
  });
});
