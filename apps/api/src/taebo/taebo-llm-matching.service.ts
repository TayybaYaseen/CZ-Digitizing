import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { FaqDto } from '@czd/shared-types';
import type { Env } from '../config/env.validation';
import type { MatchResult } from './taebo-matching.service';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const REQUEST_TIMEOUT_MS = 8000;

// docs/specs/2026-08-28-15-taebo-chatbot.md AC-7 — "the platform's selected NLP/LLM technology
// ... satisfies the anti-fabrication behavioral contract fixed in AC-3/AC-4 (never guesses,
// escalates on no-match) regardless of which specific model/library implements the matching."
//
// This is retrieval-constrained, not an open chatbot: the model is only ever shown the approved,
// published, taebo_visible FAQ list and is instructed to return matchedFaqId: null rather than
// answer from general knowledge. It may rephrase the matched answer in Taebo's persona, but the
// SYSTEM_PROMPT forbids adding any fact not present in the given answer text. The restricted-topic
// keyword gate in taebo-restricted-topics.util.ts still runs *before* this is ever called
// (TaeboService.chat) — this class is never the only thing standing between a payment/price/
// order-status question and a wrong answer.
const SYSTEM_PROMPT = `You are Taebo, the official AI assistant of a machine embroidery digitizing and vector art studio website. Your avatar is a friendly, hyper-realistic, extremely cute baby panda.

Tone: warm, sweet, and professional. If the customer writes in Roman Urdu/Hinglish, reply the same way (e.g. "Ji bilkul, main aapki help karta hoon!"). If they write in English, reply in clear, friendly English.

STRICT RULES — never break these under any circumstance:
1. You may ONLY answer using the exact content of the FAQ answers given to you in the user message below. Never invent, guess, assume, or add any fact — especially about payment, price, order status, or file availability — that is not present in the given FAQ answer text.
2. If none of the provided FAQs answer the customer's question, or you are not fully confident one of them does, you MUST return matchedFaqId: null. Do not attempt to answer from general knowledge, and do not pick the closest-sounding FAQ if it does not actually answer the question.
3. Respond with ONLY a single JSON object and nothing else — no markdown, no code fences, no explanation outside the JSON:
{"matchedFaqId": "<id of the best-matching FAQ from the list, or null>", "styledAnswer": "<null if matchedFaqId is null, otherwise the matched FAQ's answer rephrased in your warm panda persona and in the customer's language, staying 100% factually faithful to the original answer text — do not add anything it doesn't say>"}`;

interface OpenRouterChoice {
  message?: { content?: string };
}
interface OpenRouterResponse {
  choices?: OpenRouterChoice[];
}
interface LlmMatchOutput {
  matchedFaqId?: string | null;
  styledAnswer?: string | null;
}

@Injectable()
export class TaeboLlmMatchingService {
  private readonly logger = new Logger(TaeboLlmMatchingService.name);
  private readonly apiKey?: string;
  private readonly model: string;

  constructor(config: ConfigService<Env, true>) {
    this.apiKey = config.get('OPENROUTER_API_KEY', { infer: true });
    this.model = config.get('OPENROUTER_MODEL', { infer: true });
  }

  isConfigured(): boolean {
    return Boolean(this.apiKey);
  }

  // Returns null on any failure (unconfigured, network error, timeout, malformed response, or the
  // model itself returning no-match) — TaeboMatchingService treats null as "fall back to the local
  // keyword matcher", never as an error to surface to the customer.
  async findBestMatch(question: string, candidates: FaqDto[]): Promise<MatchResult | null> {
    if (!this.isConfigured() || candidates.length === 0) return null;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(OPENROUTER_URL, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.model,
          response_format: { type: 'json_object' },
          temperature: 0.2,
          // Without an explicit cap, OpenRouter defaults to the model's own max output (65535 for
          // gemini-2.5-flash) and checks account balance against that ceiling rather than actual
          // usage — a free/low-balance account gets rejected with 402 even though the reply here
          // is always a small JSON object. The matched-FAQ answer can be long, so this is generous
          // enough to never truncate a real reply while staying well under any free-tier balance.
          max_tokens: 800,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: this.buildUserPrompt(question, candidates) },
          ],
        }),
      });
      if (!response.ok) {
        this.logger.warn(`OpenRouter request failed: ${response.status}`);
        return null;
      }

      const body = (await response.json()) as OpenRouterResponse;
      const content = body.choices?.[0]?.message?.content;
      if (!content) return null;

      const parsed = this.parseOutput(content);
      if (!parsed?.matchedFaqId) return null;

      // Defensive validation — reject a hallucinated id that isn't actually in the candidate list
      // we sent, rather than trusting the model's own bookkeeping.
      const faq = candidates.find((f) => f.id === String(parsed.matchedFaqId));
      if (!faq) {
        this.logger.warn(`OpenRouter returned matchedFaqId not in candidate list: ${parsed.matchedFaqId}`);
        return null;
      }

      const styledAnswer = typeof parsed.styledAnswer === 'string' && parsed.styledAnswer.trim() ? parsed.styledAnswer.trim() : faq.answer;
      return { faq: { ...faq, answer: styledAnswer }, score: 1 };
    } catch (err) {
      this.logger.warn(`OpenRouter matching failed, falling back to keyword matcher: ${(err as Error).message}`);
      return null;
    } finally {
      clearTimeout(timeout);
    }
  }

  private buildUserPrompt(question: string, candidates: FaqDto[]): string {
    const faqList = candidates.map((f) => `- id: ${f.id}\n  question: ${f.question}\n  answer: ${f.answer}`).join('\n');
    return `Customer question: "${question}"\n\nApproved FAQ list (ONLY source of truth — do not use any other information):\n${faqList}`;
  }

  private parseOutput(content: string): LlmMatchOutput | null {
    try {
      // Models occasionally wrap JSON in a code fence despite instructions not to — strip it
      // rather than failing outright on an otherwise-well-formed response.
      const cleaned = content.trim().replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
      return JSON.parse(cleaned) as LlmMatchOutput;
    } catch {
      this.logger.warn('OpenRouter returned non-JSON content');
      return null;
    }
  }
}
