import type { TestimonialStatus } from '@czd/shared-types';
import type { TestimonialModeration } from '../generated/prisma';

// Control characters other than tab (9) and newline (10) — carriage returns are normalised to \n
// first. Built from char codes so the source contains no raw control bytes.
const CONTROL_CHARS = new RegExp(
  '[' + String.fromCharCode(0) + '-' + String.fromCharCode(8) + String.fromCharCode(11) + '-' + String.fromCharCode(31) + String.fromCharCode(127) + ']',
  'g',
);

// docs/specs/2026-10-06-22-customer-review-submission.md §19/§24 — review text is plain text: strip
// control characters, normalise line endings, trim. Never HTML-escaped here (React escapes on render),
// so the stored text is exactly what the customer wrote.
export function cleanReviewText(value: string): string {
  return value.replace(/\r\n?/g, '\n').replace(CONTROL_CHARS, '').trim();
}

// Single-line fields (name, country, service): additionally collapse any whitespace run to one space.
export function cleanReviewLine(value: string): string {
  return cleanReviewText(value).replace(/\s+/g, ' ');
}

// §18 duplicate check — case, punctuation spacing and whitespace differences don't make it "new".
export function normalizeForDuplicateCheck(value: string): string {
  return cleanReviewText(value).toLowerCase().replace(/\s+/g, ' ');
}

// §10 — the one place the four statuses are derived from the two stored columns.
export function deriveTestimonialStatus(row: { moderationStatus: TestimonialModeration; isPublished: boolean }): TestimonialStatus {
  if (row.moderationStatus === 'pending') return 'pending';
  if (row.moderationStatus === 'rejected') return 'rejected';
  return row.isPublished ? 'published' : 'hidden';
}
