import type { TaeboNoticeKey } from '@czd/shared-types';

// Purely conversational messages ("hi", "thanks!", "ok", "help") are not questions: matching them
// against the FAQ produced false matches (any FAQ answer starting "Yes —" scored 100% for "yes"),
// and escalating them filled Admin's unanswered queue with noise. They get a short, localized
// conversational reply instead (rendered client-side from `noticeKey`).
//
// A message counts only when EVERY word is conversational — "hi, what formats do you have?" is a
// real question and goes through the normal pipeline. The word lists are small and closed on
// purpose; anything domain-specific is left to the FAQ/LLM matcher.
const GREETING = ['hi', 'hii', 'hiii', 'hello', 'helo', 'hey', 'heya', 'hola', 'bonjour', 'salam', 'salaam', 'assalam', 'assalamualaikum', 'aoa', 'namaste', 'morning', 'afternoon', 'evening', 'السلام', 'سلام', 'مرحبا', 'علیکم', 'عليكم'];
const THANKS = ['thanks', 'thank', 'thx', 'thnx', 'ty', 'shukriya', 'shukria', 'merci', 'gracias', 'danke', 'شکریہ', 'شكرا', 'appreciate', 'appreciated'];
const ACK = ['yes', 'yeah', 'yep', 'yup', 'no', 'nope', 'nah', 'ok', 'okay', 'okk', 'k', 'sure', 'fine', 'cool', 'great', 'nice', 'alright', 'perfect', 'awesome', 'got', 'understood', 'hmm', 'ji', 'jee', 'haan', 'han', 'nahi', 'theek', 'acha', 'achha'];
const HELP = ['help', 'helpp', 'assist', 'assistance', 'support', 'مدد'];
const FILLER = ['good', 'so', 'much', 'very', 'a', 'lot', 'you', 'u', 'me', 'i', 'can', 'need', 'please', 'pls', 'plz', 'taebo', 'there', 'it', 'that', 'all', 'for', 'your', 'the', 'oh', 'ah', 'kar', 'karo', 'do', 'want', 'some', 'hai', 'he', 'ho'];

const CATEGORY_WORDS: [TaeboNoticeKey, Set<string>][] = [
  ['help', new Set(HELP)],
  ['thanks', new Set(THANKS)],
  ['hello', new Set(GREETING)],
  ['ack', new Set(ACK)],
];
const FILLER_SET = new Set(FILLER);
const MAX_SMALL_TALK_WORDS = 6;

export function detectSmallTalk(message: string): TaeboNoticeKey | null {
  const words = message
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0 || words.length > MAX_SMALL_TALK_WORDS) return null;

  const found = new Set<TaeboNoticeKey>();
  for (const word of words) {
    const category = CATEGORY_WORDS.find(([, set]) => set.has(word));
    if (category) found.add(category[0]);
    else if (!FILLER_SET.has(word)) return null; // a real content word — not small talk
  }
  // Priority when mixed ("hi, thanks", "ok help"): help > thanks > hello > ack.
  return CATEGORY_WORDS.map(([key]) => key).find((key) => found.has(key)) ?? null;
}
