import type { AuthenticatedRequest } from './decorators/current-user.decorator';

const STAFF_ROLES = new Set(['admin', 'freelancer', 'moderator']);

// A public visitor or authenticated customer sees published-only; admin/freelancer/moderator
// managing content need to see unpublished rows too (e.g. to publish a newly created one). Same
// rule as designs/staff-visibility.util.ts, shared here so every Content & Knowledge Base module
// (faq/tips/testimonials/blog/portfolio) doesn't duplicate it.
export function publishedOnlyFor(req: Partial<AuthenticatedRequest>): boolean {
  return !req.user || !STAFF_ROLES.has(req.user.role);
}
