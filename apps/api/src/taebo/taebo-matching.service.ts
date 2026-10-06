import { Injectable, Logger } from '@nestjs/common';
import type { FaqDto } from '@czd/shared-types';
import { TaeboKnowledgeService } from './taebo-knowledge.service';
import { TaeboLlmMatchingService, type TaeboHistoryEntry } from './taebo-llm-matching.service';

const STOPWORDS = new Set([
  'a', 'an', 'the', 'is', 'are', 'was', 'were', 'do', 'does', 'did', 'i', 'you', 'my', 'me', 'to',
  'for', 'of', 'in', 'on', 'and', 'or', 'can', 'how', 'what', 'when', 'where', 'why', 'it', 'this',
  'that', 'be', 'have', 'has', 'with', 'about', 'your', 'yours', 'please', 'would', 'could', 'will',
  // Conversational filler that carries no topic of its own. Without these, a short message like
  // "do u make logos?" or "I need help" was scored on "make"/"need"/"help" alone, which can appear
  // in any FAQ answer.
  'u', 'ur', 'pls', 'plz', 'hi', 'hello', 'hey', 'yes', 'no', 'ok', 'okay', 'need', 'want', 'help',
  'know', 'tell', 'get', 'make', 'there', 'any', 'some', 'much', 'many', 'more', 'info',
  'information', 'question', 'details', 'which', 'who', 'should', 'we', 'our', 'us', 'they', 'them',
  'their', 'if', 'so', 'at', 'by', 'from', 'as', 'just', 'also', 'its', 'am', 'not', 'dont', 'than',
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
      .replace(/[’']/g, '')
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 1 && !STOPWORDS.has(w))
      .map(stem),
  );
}

// Optimal-string-alignment edit distance (Levenshtein + adjacent transposition), capped: returns
// max+1 as soon as the distance is known to exceed `max`.
function editDistance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const prev2: number[] = new Array(b.length + 1).fill(0);
  let prev: number[] = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur: number[] = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, prev2[j - 2] + 1);
      cur[j] = v;
      rowMin = Math.min(rowMin, v);
    }
    if (rowMin > max) return max + 1;
    prev2.splice(0, prev2.length, ...prev);
    prev = cur;
  }
  return prev[b.length];
}

// Catches word-family relations the crude suffix-stripper above misses — "customize"/
// "customized"/"customization" all share a >=5-char prefix with "custom" without needing a real
// stemmer's suffix rules for each one individually. Requires both tokens to be at least 5 chars
// (not just any shared prefix) so short unrelated words ("cat"/"car") never collide. Typo tolerance
// ("embroidry", "digitzing", "formts") needs a longer floor still — the crude stemmer above leaves
// 5-char fragments that are one edit from real words ("proceed" -> "proce" ~ "price"): one edit
// for 6-8 chars, two for 9+.
const FUZZY_PREFIX_MIN_LEN = 5;
const TYPO_MIN_LEN = 6;

function tokensMatch(a: string, b: string): boolean {
  if (a === b) return true;
  if (a.length < FUZZY_PREFIX_MIN_LEN || b.length < FUZZY_PREFIX_MIN_LEN) return false;
  if (a.length <= b.length ? b.startsWith(a) : a.startsWith(b)) return true;
  const shorter = Math.min(a.length, b.length);
  if (shorter < TYPO_MIN_LEN) return false;
  const allowed = shorter >= 9 ? 2 : 1;
  return editDistance(a, b, allowed) <= allowed;
}

function containsToken(tokens: Iterable<string>, token: string): boolean {
  for (const t of tokens) if (tokensMatch(token, t)) return true;
  return false;
}

function overlapScore(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  const matched = [...a].filter((ta) => containsToken(b, ta)).length;
  // Symmetric-ish: a short admin-authored FAQ question against a longer customer phrasing (or vice
  // versa) shouldn't be penalized just for length asymmetry — score against whichever side is
  // smaller, which is the more forgiving (but still meaningful-overlap-required) denominator.
  // Single-word queries never reach this (see matchSingleToken) — for them this ratio is always
  // 0 or 1 and can't tell a relevant FAQ from one that merely mentions the word.
  return matched / Math.min(a.size, b.size);
}

// How many candidate FAQs contain each token, across their question+topic+answer text. Used only
// to rank *ties* between FAQs that already clear MIN_CONFIDENCE/ANSWER_MIN_CONFIDENCE below — never
// to change whether a match passes. Weighting by inverse document frequency (rarer token = more
// weight) stops a match on a word that appears in nearly every FAQ (e.g. "embroidery") tying with
// or beating a match on one that appears only in the relevant FAQ (e.g. "whatsapp").
function buildDocFrequency(faqs: IndexedFaq[]): Map<string, number> {
  const df = new Map<string, number>();
  for (const faq of faqs) {
    for (const token of faq.all) df.set(token, (df.get(token) ?? 0) + 1);
  }
  return df;
}

function specificityScore(questionTokens: Set<string>, faqTokens: Set<string>, docFrequency: Map<string, number>): number {
  let total = 0;
  for (const qt of questionTokens) {
    if (containsToken(faqTokens, qt)) total += 1 / (docFrequency.get(qt) ?? 1);
  }
  return total;
}

interface IndexedFaq {
  faq: FaqDto;
  // FAQ question + topic (the main matching channel) / the FAQ question alone.
  question: Set<string>;
  questionOnly: Set<string>;
  answer: Set<string>;
  all: Set<string>;
}

function indexFaqs(candidates: FaqDto[]): IndexedFaq[] {
  return candidates.map((faq) => {
    const questionOnly = tokenize(faq.question);
    const question = tokenize(`${faq.question} ${faq.topic}`);
    const answer = tokenize(faq.answer);
    return { faq, question, questionOnly, answer, all: new Set([...question, ...answer]) };
  });
}

export interface MatchResult {
  faq: FaqDto;
  score: number;
}

// match: one confident FAQ. ambiguous: a single-word question ("order?") that several FAQs are
// about equally — offered back as "did you mean", never guessed between.
export type KeywordMatch = ({ type: 'match' } & MatchResult) | { type: 'ambiguous'; faqs: FaqDto[] };

// What TaeboService gets back. answer: grounded in approved content. reply: conversational text
// (clarifying question/greeting/refusal) with no facts in it. clarify: "did you mean" options.
// account: needs the customer's live account data (AC-4) — must be escalated.
export type TaeboResolution =
  | { type: 'answer'; answer: string; faqId?: string }
  | { type: 'reply'; answer: string }
  | { type: 'clarify'; options: FaqDto[] }
  | { type: 'account' };

export interface ResolveInput {
  message: string;
  history: TaeboHistoryEntry[];
  languageCode?: string;
}

const MAX_CLARIFY_OPTIONS = 3;
// A follow-up this short ("what about DST?", "and the price?") is read together with the
// customer's previous question when it doesn't match anything on its own.
const FOLLOW_UP_MAX_TOKENS = 3;

// docs/specs/2026-08-28-15-taebo-chatbot.md AC-2/AC-7 — swappable behind this one interface so the
// matching strategy can change without TaeboService (which owns the anti-fabrication contract:
// escalate whenever this returns null) changing.
@Injectable()
export class TaeboMatchingService {
  private readonly logger = new Logger(TaeboMatchingService.name);

  // Conservative on purpose: a low bar here is exactly the fabrication risk AC-3/AC-4 exist to
  // prevent. Tuned to require multiple overlapping meaningful words, not a single common one.
  private static readonly MIN_CONFIDENCE = 0.5;
  // The FAQ's own question text is the strongest signal of intent match; the answer body is a
  // weaker, indirect signal, so it needs a *higher* bar to qualify on its own — not a lower one.
  private static readonly ANSWER_MIN_CONFIDENCE = 0.7;

  constructor(
    private readonly knowledge: TaeboKnowledgeService,
    private readonly llm: TaeboLlmMatchingService,
  ) {}

  async resolve(input: ResolveInput): Promise<TaeboResolution | null> {
    const { faqs, items } = await this.knowledge.load();

    // AC-7 — prefer the configured LLM when available: it understands intent, typos and
    // follow-ups, and answers from all approved knowledge (not just one FAQ). Any failure
    // (unconfigured, network error, timeout, malformed or unverifiable output) or an explicit
    // "unknown" falls through to the local keyword matcher below rather than surfacing an error,
    // so Taebo never has a hard dependency on a third-party API for basic operation.
    if (this.llm.isConfigured()) {
      const llm = await this.llm.respond(input.message, input.history, items, input.languageCode);
      if (llm?.kind === 'answer') {
        const faqSource = llm.sourceIds.map((id) => items.find((k) => k.id === id)?.faqId).find(Boolean);
        return { type: 'answer', answer: llm.answer, faqId: faqSource };
      }
      if (llm?.kind === 'reply') return { type: 'reply', answer: llm.answer };
      // AC-4 in a language the deterministic gate doesn't cover — escalate, never keyword-match.
      if (llm?.kind === 'account') return { type: 'account' };
      this.logger.debug(`LLM ${llm ? 'had no grounded answer' : 'failed'}; trying keyword matcher`);
    }

    if (faqs.length === 0) return null;
    const previousQuestion = [...input.history].reverse().find((h) => h.sender === 'customer')?.message;
    const match = this.keywordMatch(input.message, faqs, previousQuestion);
    if (!match) return null;
    if (match.type === 'ambiguous') return { type: 'clarify', options: match.faqs };
    return { type: 'answer', answer: match.faq.answer, faqId: match.faq.id };
  }

  keywordMatch(question: string, candidates: FaqDto[], previousQuestion?: string): KeywordMatch | null {
    if (candidates.length === 0) return null;
    const indexed = indexFaqs(candidates);
    const tokens = tokenize(question);

    const direct = tokens.size === 1 ? this.matchSingleToken([...tokens][0], indexed) : this.matchTokens(tokens, indexed);
    if (direct?.type === 'match' || !previousQuestion || tokens.size === 0 || tokens.size > FOLLOW_UP_MAX_TOKENS) return direct;

    // Follow-up ("What about DST?" after a formats question): combine with the previous question,
    // but only accept an FAQ that also covers something the customer just said — otherwise the
    // previous question alone would be answered again.
    const combined = this.matchTokens(new Set([...tokenize(previousQuestion), ...tokens]), indexed);
    if (combined?.type === 'match' && [...tokens].some((t) => containsToken(tokenize(`${combined.faq.question} ${combined.faq.topic} ${combined.faq.answer}`), t))) {
      return combined;
    }
    return direct;
  }

  // One meaningful word ("DST?", "formats?", "order?"): accept it only when exactly one FAQ is
  // about it — mentioned in just one FAQ overall, or in just one FAQ's question (not its topic,
  // which is a broad category label like "Embroidery Designs"). Several equally plausible FAQs →
  // ask which one ("did you mean"), never pick one arbitrarily.
  private matchSingleToken(token: string, indexed: IndexedFaq[]): KeywordMatch | null {
    const mentions = indexed.filter((f) => containsToken(f.all, token));
    if (mentions.length === 0) return null;
    if (mentions.length === 1) return { type: 'match', faq: mentions[0].faq, score: 1 };
    const inQuestion = mentions.filter((f) => containsToken(f.questionOnly, token));
    if (inQuestion.length === 1) return { type: 'match', faq: inQuestion[0].faq, score: 1 };
    const options = (inQuestion.length > 0 ? inQuestion : mentions).slice(0, MAX_CLARIFY_OPTIONS).map((f) => f.faq);
    return { type: 'ambiguous', faqs: options };
  }

  private matchTokens(questionTokens: Set<string>, indexed: IndexedFaq[]): KeywordMatch | null {
    if (questionTokens.size === 0) return null;
    const docFrequency = buildDocFrequency(indexed);

    let best: MatchResult | null = null;
    let bestSpecificity = -Infinity;
    for (const f of indexed) {
      const questionScore = overlapScore(questionTokens, f.question);
      const answerScore = overlapScore(questionTokens, f.answer);
      const passesQuestion = questionScore >= TaeboMatchingService.MIN_CONFIDENCE;
      const passesAnswer = answerScore >= TaeboMatchingService.ANSWER_MIN_CONFIDENCE;
      if (!passesQuestion && !passesAnswer) continue;

      const score = Math.max(questionScore, passesAnswer ? answerScore : 0);
      // Break ties (common on short queries) by how distinctive the matched words are across the
      // whole candidate set, not just raw overlap ratio — see specificityScore/buildDocFrequency.
      const specificity = specificityScore(questionTokens, f.all, docFrequency);
      if (!best || specificity > bestSpecificity || (specificity === bestSpecificity && score > best.score)) {
        best = { faq: f.faq, score };
        bestSpecificity = specificity;
      }
    }
    return best ? { type: 'match', ...best } : null;
  }
}
