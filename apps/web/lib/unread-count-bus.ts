// docs/specs/2026-08-28-02-notifications-system.md AC-8 — lets the notifications page
// (mark-read) push an immediate unread-count delta to NotificationBell instead of waiting for its
// next 30s poll (NotificationBell.tsx). Polling stays as-is as the fallback for changes originating
// elsewhere (another tab, another device).
type Listener = (delta: number) => void;
const listeners = new Set<Listener>();

export function publishUnreadCountDelta(delta: number): void {
  listeners.forEach((listener) => listener(delta));
}

export function subscribeToUnreadCountDelta(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
