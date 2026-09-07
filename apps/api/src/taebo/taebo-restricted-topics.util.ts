// docs/specs/2026-08-28-15-taebo-chatbot.md AC-4, §8 risk #2. Deliberately a plain, auditable
// keyword list rather than a classifier: a false negative here is a fabrication-risk incident
// (spec §8), so the list is kept deliberately over-inclusive — a false positive just means one
// extra "I've passed this to our team" reply, which is the safe direction to err in.
//
// Covers AC-4's four named categories: payment status, price, order status, file availability.
const RESTRICTED_TOPIC_KEYWORDS = [
  // payment status / price
  'pay',
  'payment',
  'paid',
  'price',
  'cost',
  'refund',
  'invoice',
  'receipt',
  'discount',
  'charge',
  'charged',
  'billing',
  // order status
  'order status',
  'my order',
  'track',
  'tracking',
  'shipped',
  'delivery',
  'when will i',
  'order number',
  // file availability
  'download',
  'file ready',
  'files ready',
  'is my file',
  'available yet',
];

export function isRestrictedTopic(question: string): boolean {
  const normalized = question.toLowerCase();
  return RESTRICTED_TOPIC_KEYWORDS.some((keyword) => normalized.includes(keyword));
}
