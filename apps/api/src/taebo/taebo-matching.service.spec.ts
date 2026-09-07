import type { FaqDto } from '@czd/shared-types';
import type { MatchResult } from './taebo-matching.service';
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

function createFakeFaqService(faqs: FaqDto[]) {
  return { listTaeboVisible: jest.fn(async () => faqs) };
}

// Unconfigured by default (isConfigured: false) so every existing test still exercises the local
// keyword matcher unchanged; the LLM-specific tests below override this.
function createFakeLlm(overrides: { isConfigured?: boolean; findBestMatch?: (q: string, c: FaqDto[]) => Promise<MatchResult | null> } = {}) {
  return {
    isConfigured: jest.fn(() => overrides.isConfigured ?? false),
    findBestMatch: jest.fn(overrides.findBestMatch ?? (async () => null)),
  };
}

// docs/specs/2026-08-28-15-taebo-chatbot.md AC-2/AC-3/AC-7 — only returns a match when confidence
// clears the deliberately conservative bar; never guesses on an unrelated question; the LLM path
// (AC-7) is tried first when configured but always falls back to the local keyword matcher on any
// failure or no-match, never surfacing an error.
describe('TaeboMatchingService', () => {
  it('matches a question that overlaps meaningfully with an FAQ', async () => {
    const faqs = [makeFaq({ id: '1', question: 'What file formats do you support?', topic: 'formats' })];
    const service = new TaeboMatchingService(createFakeFaqService(faqs) as never, createFakeLlm() as never);

    const result = await service.findBestMatch('What file formats are supported?');

    expect(result?.faq.id).toBe('1');
  });

  it('matches a longer, differently-worded customer question against a short FAQ question (stemming + min-size scoring)', async () => {
    const faqs = [makeFaq({ id: '1', question: 'What file formats do you support?', topic: 'formats' })];
    const service = new TaeboMatchingService(createFakeFaqService(faqs) as never, createFakeLlm() as never);

    const result = await service.findBestMatch('Hi there, I was wondering which embroidery file formats you are able to support for my project?');

    expect(result?.faq.id).toBe('1');
  });

  it('matches via the answer text when the question wording shares nothing with the FAQ question but strongly overlaps the answer', async () => {
    const faqs = [
      makeFaq({
        id: '1',
        question: 'More details',
        topic: 'info',
        answer: 'We offer embroidery designs in multiple standard sizes such as 4x4, 5x7, and 6x10 inches.',
      }),
    ];
    const service = new TaeboMatchingService(createFakeFaqService(faqs) as never, createFakeLlm() as never);

    const result = await service.findBestMatch('What standard sizes do you offer for embroidery designs?');

    expect(result?.faq.id).toBe('1');
  });

  it('does not match via the answer text when overlap is only partial (answer channel needs a higher bar)', async () => {
    const faqs = [
      makeFaq({
        id: '1',
        question: 'More details',
        topic: 'info',
        answer: 'We offer embroidery designs in multiple standard sizes such as 4x4, 5x7, and 6x10 inches.',
      }),
    ];
    const service = new TaeboMatchingService(createFakeFaqService(faqs) as never, createFakeLlm() as never);

    const result = await service.findBestMatch('Do you have any discounts on bulk orders?');

    expect(result).toBeNull();
  });

  it('matches word-family variants via fuzzy prefix ("customize" against "custom")', async () => {
    const faqs = [
      makeFaq({
        id: '1',
        question: 'Do you offer custom design services?',
        topic: 'custom-design',
        answer: 'Yes! We offer custom embroidery digitizing and custom vector art design tailored to your requirements.',
      }),
    ];
    const service = new TaeboMatchingService(createFakeFaqService(faqs) as never, createFakeLlm() as never);

    const result = await service.findBestMatch('Would you design customize?');

    expect(result?.faq.id).toBe('1');
  });

  it('does not fuzzy-match short unrelated words', async () => {
    const faqs = [makeFaq({ id: '1', question: 'Do you have a cat mascot?', topic: 'misc' })];
    const service = new TaeboMatchingService(createFakeFaqService(faqs) as never, createFakeLlm() as never);

    const result = await service.findBestMatch('Can I rent a car?');

    expect(result).toBeNull();
  });

  it('returns null when no FAQ meaningfully overlaps (AC-3: never guess)', async () => {
    const faqs = [makeFaq({ id: '1', question: 'What file formats do you support?', topic: 'formats' })];
    const service = new TaeboMatchingService(createFakeFaqService(faqs) as never, createFakeLlm() as never);

    const result = await service.findBestMatch('Do you ship internationally?');

    expect(result).toBeNull();
  });

  it('returns null when there are no taebo-visible candidates at all', async () => {
    const service = new TaeboMatchingService(createFakeFaqService([]) as never, createFakeLlm() as never);

    const result = await service.findBestMatch('What file formats do you support?');

    expect(result).toBeNull();
  });

  it('AC-7: uses the LLM matcher result when configured and it returns a match', async () => {
    const faqs = [makeFaq({ id: '1' })];
    const llmMatch: MatchResult = { faq: { ...faqs[0], answer: 'Styled panda answer' }, score: 1 };
    const llm = createFakeLlm({ isConfigured: true, findBestMatch: async () => llmMatch });
    const service = new TaeboMatchingService(createFakeFaqService(faqs) as never, llm as never);

    const result = await service.findBestMatch('Completely unrelated phrasing the keyword matcher would reject');

    expect(result?.faq.answer).toBe('Styled panda answer');
    expect(llm.findBestMatch).toHaveBeenCalled();
  });

  it('AC-7: falls back to the keyword matcher when the LLM is configured but returns no match/fails', async () => {
    const faqs = [makeFaq({ id: '1', question: 'What file formats do you support?', topic: 'formats' })];
    const llm = createFakeLlm({ isConfigured: true, findBestMatch: async () => null });
    const service = new TaeboMatchingService(createFakeFaqService(faqs) as never, llm as never);

    const result = await service.findBestMatch('What file formats are supported?');

    expect(result?.faq.id).toBe('1');
    expect(llm.findBestMatch).toHaveBeenCalled();
  });
});
