import type { AuthenticatedRequest } from '../common/decorators/current-user.decorator';

const STAFF_ROLES = new Set(['admin', 'freelancer', 'moderator']);

// A public visitor or authenticated customer sees published-only; admin/freelancer/moderator
// managing the catalog need to see unpublished rows too (e.g. to publish a newly created one).
export function publishedOnlyFor(req: Partial<AuthenticatedRequest>): boolean {
  return !req.user || !STAFF_ROLES.has(req.user.role);
}
