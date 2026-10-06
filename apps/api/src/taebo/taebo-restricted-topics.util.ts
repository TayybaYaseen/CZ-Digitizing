// docs/specs/2026-08-28-15-taebo-chatbot.md AC-4, §8 risk #2. AC-4 restricts questions "where Taebo
// would need live/customer-specific data it cannot verifiably access from approved content" — the
// status of *this customer's* payment, order, refund or files. Those always escalate, before any
// matcher/LLM runs.
//
// General policy questions on the same subjects ("What payment methods do you accept?", "When can I
// download my purchased files?", "How much is a subscription?") are NOT restricted: they are
// answered only from approved, published content (FAQ / pricing), or escalated if none exists. The
// previous plain-substring list blocked those too — including Taebo's own suggested FAQs — and also
// fired inside unrelated words ("display" contains "pay").
//
// Still deliberately a plain, auditable pattern list rather than a classifier: a false negative
// here is a fabrication-risk incident, a false positive is just one extra escalation.
const ACCOUNT_SPECIFIC_PATTERNS: RegExp[] = [
  // "my order/refund/invoice" — the possessive is what makes it about live account data. Payments
  // and files are covered by the status patterns below instead, so how-to questions like "When can
  // I download my purchased files?" or "How do I upload my receipt?" still get their FAQ answer.
  /\bmy\s+(?:\w+\s+)?(?:order|orders|refund|invoice)\b/,
  /\b(?:payment|transfer|receipt)\s+(?:gone|went|go)\s+through\b/,
  /\bmy\s+(?:payment|transfer|receipt)\s+(?:been\s+)?(?:confirmed|approved|received|verified|rejected|accepted|pending)\b/,
  /\b(?:order|payment|refund|delivery|shipping)\s+(?:status|number|id)\b/,
  /\b(?:track|tracking)\b/,
  /\brefund(?:ed|s)?\b/,
  /\b(?:was|been|got|get)\s+(?:i\s+)?(?:charged|debited)\b/,
  /\b(?:charged|debited)\s+(?:twice|me|my)\b/,
  /\bwhere\s+is\s+my\b/,
  /\bwhen\s+will\s+i\s+(?:get|receive)\b/,
  /\b(?:has|have|did)\s+(?:my|the)\s+(?:payment|transfer|receipt|order)\b/,
  /\b(?:is|are)\s+my\s+\w+\s+(?:ready|confirmed|approved|available|shipped|delivered)\b/,
  /\bavailable\s+yet\b/,
];

export function isRestrictedTopic(question: string): boolean {
  const normalized = question.toLowerCase().replace(/[’']/g, '');
  return ACCOUNT_SPECIFIC_PATTERNS.some((pattern) => pattern.test(normalized));
}

// Requests for internal/system information (credentials, keys, prompts, database, other customers'
// data) get a polite refusal instead of an answer or an Admin escalation. Taebo's grounding context
// never contains any of this to begin with (TaeboKnowledgeService only reads published content) —
// this is a second, deterministic layer so such probes never even reach the LLM.
//
// Phrases are specific on purpose: "I forgot my password" is a normal FAQ, "admin password" is not.
const INTERNAL_INFO_PATTERNS: RegExp[] = [
  /\b(?:admin|administrator|database|db|server|root|staff)\s+(?:password|passwords|credentials?|login|logins|access)\b/,
  /\b(?:api|secret|private|access)\s*[-_ ]?keys?\b/,
  /\b(?:system|internal|hidden|initial|your)\s+(?:prompt|prompts|instructions)\b/,
  /\bignore\s+(?:all\s+|the\s+|your\s+)?(?:previous|prior|above)\b/,
  /\b(?:environment|env)\s+(?:variables?|vars?|file)\b|\.env\b/,
  /\b(?:database|db)\s+(?:url|schema|tables?|dump|connection|details)\b/,
  /\b(?:connection\s+string|access\s+token|jwt\s+secret|openrouter)\b/,
  /\b(?:other|all)\s+(?:customers?|users?)(?:'s|s')?\s+(?:data|details|emails?|orders?|info|information|phone|numbers?|addresses?)\b/,
  /\b(?:customer|user)\s+(?:list|database|emails)\b/,
];

export function isInternalInfoRequest(question: string): boolean {
  const normalized = question.toLowerCase().replace(/[’']/g, "'");
  return INTERNAL_INFO_PATTERNS.some((pattern) => pattern.test(normalized));
}
