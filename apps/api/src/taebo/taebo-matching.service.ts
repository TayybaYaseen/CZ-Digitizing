import { Injectable, Logger } from '@nestjs/common';
import type { FaqDto } from '@czd/shared-types';
import { FaqService } from '../faq/faq.service';
import { TaeboLlmMatchingService } from './taebo-llm-matching.service';

const STOPWORDS = new Set([
  'a', 'an', 'the', 'is', 'are', 'was', 'were', 'do', 'does', 'did', 'i', 'you', 'my', 'me', 'to',
  'for', 'of', 'in', 'on', 'and', 'or', 'can', 'how', 'what', 'when', 'where', 'why', 'it', 'this',
  'that', 'be', 'have', 'has', 'with', 'about', 'your', 'yours', 'please', 'would', 'could', 'will',
]);

// Deliberately crude suffix-stripping, not a real stemmer — just enough to catch the common
// question/answer mismatches ("formats" vs "format", "supported" vs "support") without pulling in
// an NLP dependency. AC-7 only requires the anti-fabrication contract to hold regardless of
// implementation, not any particular matching sophistication.
function stem(word: string): string {
  if (word.length > 5 && word.endsWith('ing')) return word.slice(0, -3);
  if (word.length > 4 && word.endsWith('ed')) return word.slice(0, -2);
  if (word.length > 4 && word.endsWith('ies')) return `${word.slice(0, -3)}y`;
  if (word.length > 4 && word.endsWith('es')) return word.slice(0, -2);
  if (word.length > 3 && word.endsWith('s') && !word.endsWith('ss')) return word.slice(0, -1);
  return word;
}

function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 1 && !STOPWORDS.has(w))
      .map(stem),
  );
}

// Catches word-family relations the crude suffix-stripper above misses — "customize"/
// "customized"/"customization" all share a >=5-char prefix with "custom" without needing a real
// stemmer's suffix rules for each one individually. Requires both tokens to be at least 5 chars
// (not just any shared prefix) so short unrelated words ("cat"/"car") never collide.
const FUZZY_PREFIX_MIN_LEN = 5;

function tokensMatch(a: string, b: string): boolean {
  if (a === b) return true;
  if (a.length < FUZZY_PREFIX_MIN_LEN || b.length < FUZZY_PREFIX_MIN_LEN) return false;
  return a.length <= b.length ? b.startsWith(a) : a.startsWith(b);
}

function overlapScore(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  const bArr = [...b];
  const matched = [...a].filter((ta) => bArr.some((tb) => tokensMatch(ta, tb))).length;
  // Symmetric-ish: a short admin-authored FAQ question against a longer customer phrasing (or vice
  // versa) shouldn't be penalized just for length asymmetry — score against whichever side is
  // smaller, which is the more forgiving (but still meaningful-overlap-required) denominator.
  return matched / Math.min(a.size, b.size);
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
  private readonly logger = new Logger(TaeboMatchingService.name);

  // Conservative on purpose: a low bar here is exactly the fabrication risk AC-3/AC-4 exist to
  // prevent. Tuned to require multiple overlapping meaningful words, not a single common one.
  private static readonly MIN_CONFIDENCE = 0.5;
  // The FAQ's own question text is the strongest signal of intent match; the answer body is a
  // weaker, indirect signal (a customer might phrase their question using words that appear in the
  // answer but not the admin-authored question), so it needs a *higher* bar to qualify on its own
  // — not a lower one. A flat weight multiplier on the same threshold was tried and rejected: it
  // made a perfect answer-text overlap mathematically unable to ever pass, silently dead code.
  private static readonly ANSWER_MIN_CONFIDENCE = 0.7;

  constructor(
    private readonly faqs: FaqService,
    private readonly llm: TaeboLlmMatchingService,
  ) {}

  async findBestMatch(question: string, languageCode?: string): Promise<MatchResult | null> {
    const candidates = await this.faqs.listTaeboVisible(languageCode);
    if (candidates.length === 0) return null;

    // AC-7 — prefer the configured LLM matcher when available; any failure (unconfigured, network
    // error, timeout, malformed response) falls straight through to the local keyword matcher
    // below rather than surfacing an error, so Taebo never has a hard dependency on a third-party
    // API for basic operation.
    if (this.llm.isConfigured()) {
      const llmResult = await this.llm.findBestMatch(question, candidates);
      if (llmResult) return llmResult;
      this.logger.debug('LLM matcher returned no match or failed; falling back to keyword matcher');
    }

    return this.keywordMatch(question, candidates);
  }

  private keywordMatch(question: string, candidates: FaqDto[]): MatchResult | null {
    const questionTokens = tokenize(question);
    if (questionTokens.size === 0) return null;

    let best: MatchResult | null = null;
    for (const faq of candidates) {
      const questionScore = overlapScore(questionTokens, tokenize(`${faq.question} ${faq.topic}`));
      const answerScore = overlapScore(questionTokens, tokenize(faq.answer));
      const passesQuestion = questionScore >= TaeboMatchingService.MIN_CONFIDENCE;
      const passesAnswer = answerScore >= TaeboMatchingService.ANSWER_MIN_CONFIDENCE;
      if (!passesQuestion && !passesAnswer) continue;

      const score = Math.max(questionScore, passesAnswer ? answerScore : 0);
      if (!best || score > best.score) best = { faq, score };
    }
    return best;
  }
}
