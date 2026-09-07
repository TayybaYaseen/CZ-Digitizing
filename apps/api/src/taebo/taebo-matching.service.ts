import { Injectable } from '@nestjs/common';
import type { FaqDto } from '@czd/shared-types';
import { FaqService } from '../faq/faq.service';

const STOPWORDS = new Set([
  'a', 'an', 'the', 'is', 'are', 'was', 'were', 'do', 'does', 'did', 'i', 'you', 'my', 'me', 'to',
  'for', 'of', 'in', 'on', 'and', 'or', 'can', 'how', 'what', 'when', 'where', 'why', 'it', 'this',
  'that', 'be', 'have', 'has', 'with', 'about',
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 1 && !STOPWORDS.has(w));
}

export interface MatchResult {
  faq: FaqDto;
  score: number;
}

// docs/specs/2026-08-28-15-taebo-chatbot.md AC-2/AC-7 — swappable behind this one interface so a
// real NLP/embedding matcher can replace the scoring below later without any caller (TaeboService)
// changing; AC-7 only requires the anti-fabrication contract (never guess, escalate below
// MIN_CONFIDENCE), not any specific implementation.
@Injectable()
export class TaeboMatchingService {
  // Conservative on purpose: a low bar here is exactly the fabrication risk AC-3/AC-4 exist to
  // prevent. Tuned to require multiple overlapping meaningful words, not a single common one.
  private static readonly MIN_CONFIDENCE = 0.34;

  constructor(private readonly faqs: FaqService) {}

  async findBestMatch(question: string, languageCode?: string): Promise<MatchResult | null> {
    const candidates = await this.faqs.listTaeboVisible(languageCode);
    if (candidates.length === 0) return null;

    const questionTokens = new Set(tokenize(question));
    if (questionTokens.size === 0) return null;

    let best: MatchResult | null = null;
    for (const faq of candidates) {
      const faqTokens = new Set(tokenize(`${faq.question} ${faq.topic}`));
      const overlap = [...questionTokens].filter((t) => faqTokens.has(t)).length;
      const score = overlap / questionTokens.size;
      if (score >= TaeboMatchingService.MIN_CONFIDENCE && (!best || score > best.score)) {
        best = { faq, score };
      }
    }
    return best;
  }
}
