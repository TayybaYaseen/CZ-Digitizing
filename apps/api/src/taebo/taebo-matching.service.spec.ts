import type { FaqDto } from '@czd/shared-types';
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

// docs/specs/2026-08-28-15-taebo-chatbot.md AC-2/AC-7 — only returns a match when confidence
// clears the deliberately conservative bar; never guesses on an unrelated question.
describe('TaeboMatchingService', () => {
  it('matches a question that overlaps meaningfully with an FAQ', async () => {
    const faqs = [makeFaq({ id: '1', question: 'What file formats do you support?', topic: 'formats' })];
    const service = new TaeboMatchingService(createFakeFaqService(faqs) as never);

    const result = await service.findBestMatch('What file formats are supported?');

    expect(result?.faq.id).toBe('1');
  });

  it('returns null when no FAQ meaningfully overlaps (AC-3: never guess)', async () => {
    const faqs = [makeFaq({ id: '1', question: 'What file formats do you support?', topic: 'formats' })];
    const service = new TaeboMatchingService(createFakeFaqService(faqs) as never);

    const result = await service.findBestMatch('Do you ship internationally?');

    expect(result).toBeNull();
  });

  it('returns null when there are no taebo-visible candidates at all', async () => {
    const service = new TaeboMatchingService(createFakeFaqService([]) as never);

    const result = await service.findBestMatch('What file formats do you support?');

    expect(result).toBeNull();
  });
});
