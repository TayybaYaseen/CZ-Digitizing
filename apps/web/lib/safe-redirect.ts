// Validates a `?next=` redirect target from login/register/verify-device so it can only ever
// point back into this same app — a `next` value is attacker-controllable (it's a URL query
// param), so accepting anything but a same-origin relative path (never `//host/...` or
// `scheme:...`, both of which browsers/routers treat as absolute) would be an open-redirect hole.
export function safeNextPath(next: string | null): string {
  if (!next) return '/';
  if (!next.startsWith('/') || next.startsWith('//')) return '/';
  return next;
}
