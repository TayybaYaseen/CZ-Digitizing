// Customer ↔ Admin Live Chat (aspect A-025) — docs/specs/2026-10-06-21-customer-admin-live-chat.md.
// Mirrors the runtime constants in packages/shared-types/src/support-chat.ts: the API only ever
// imports *types* from @czd/shared-types (its `main` is a .ts file node can't load at runtime).

export const SUPPORT_MESSAGE_MAX_LENGTH = 4000; // §14.1 / §28.4
export const SUPPORT_PREVIEW_LENGTH = 140; // §9.2 lastMessagePreview, §17.4 notification text

export const SUPPORT_STAFF_ROLES = ['admin', 'freelancer', 'moderator'] as const;

// §21 — messages page by cursor, conversation lists by page/pageSize.
export const MESSAGE_PAGE_DEFAULT = 30;
export const MESSAGE_PAGE_MAX = 100;
export const CUSTOMER_LIST_PAGE_SIZE_DEFAULT = 20;
export const CUSTOMER_LIST_PAGE_SIZE_MAX = 50;
export const ADMIN_LIST_PAGE_SIZE_DEFAULT = 25;
export const ADMIN_LIST_PAGE_SIZE_MAX = 100;

// §28.5 — the per-IP limits are @RateLimit decorators on the routes; these are the additional
// per-user limits (IP-only limits are weak behind shared NATs and mobile carriers).
export const CUSTOMER_SEND_LIMIT = { limit: 30, windowSeconds: 60 };
export const ADMIN_SEND_LIMIT = { limit: 60, windowSeconds: 60 };
export const CUSTOMER_START_LIMIT = { limit: 10, windowSeconds: 60 * 60 };

// §11 — socket namespace, rooms and limits.
export const SUPPORT_CHAT_NAMESPACE = '/support-chat';
export const MAX_SOCKETS_PER_USER = 10;
export const SOCKET_SIGNAL_MIN_INTERVAL_MS = 1000; // typing/viewing: > 1 event/sec/socket is dropped

export const supportRooms = {
  user: (userId: string) => `support:user:${userId}`,
  staff: () => 'support:staff',
  // Both audiences join this one; it only ever carries audience-neutral payloads (typing, read).
  conversation: (conversationId: string) => `support:conversation:${conversationId}`,
  // Staff-only twin: full AdminSupportMessageDto payloads (sender names, system lines) — §28.3.
  conversationStaff: (conversationId: string) => `support:conversation:${conversationId}:staff`,
};
