import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
} from '@nestjs/websockets';
import type { SupportSocketAck } from '@czd/shared-types';
import type { DefaultEventsMap, Namespace, Socket } from 'socket.io';
import { TokenService } from '../auth/services/token.service';
import type { AccessTokenPayload } from '../auth/token.types';
import { MAX_SOCKETS_PER_USER, SOCKET_SIGNAL_MIN_INTERVAL_MS, SUPPORT_CHAT_NAMESPACE, supportRooms } from './support-chat.constants';
import { SupportChatEventsService } from './support-chat-events.service';
import { SupportChatService } from './support-chat.service';
import { SupportPresenceService } from './support-presence.service';
import { SupportStaffAccessService } from './support-staff-access.service';

interface SocketData {
  userId: string;
  role: string;
  isStaff: boolean;
  expiryTimer?: NodeJS.Timeout;
  lastSignalAt: Record<string, number>;
}

type SupportSocket = Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, SocketData>;

const ID_PATTERN = /^\d{1,18}$/;
const OK: SupportSocketAck = { ok: true };
const deny = (code: string): SupportSocketAck => ({ ok: false, code });

// docs/specs/2026-10-06-21-customer-admin-live-chat.md §11 — the `/support-chat` namespace on the
// SAME Socket.IO server the `/custom-requests` gateway already uses (no second realtime system, no new
// packages). Push-only for data: every write is a REST call (§11.1), so this gateway never touches
// messages, statuses or read pointers — it authenticates, puts sockets in the right rooms, relays
// typing, and records "viewing" for notification suppression (§17.3).
@WebSocketGateway({ namespace: SUPPORT_CHAT_NAMESPACE })
export class SupportChatGateway implements OnGatewayInit, OnGatewayDisconnect {
  private readonly logger = new Logger(SupportChatGateway.name);
  private readonly allowedOrigins: Set<string>;

  constructor(
    private readonly tokens: TokenService,
    private readonly service: SupportChatService,
    private readonly events: SupportChatEventsService,
    private readonly presence: SupportPresenceService,
    private readonly staffAccess: SupportStaffAccessService,
    config: ConfigService,
  ) {
    this.allowedOrigins = new Set(
      (config.get<string>('CORS_ORIGINS') ?? '')
        .split(',')
        .map((o) => o.trim())
        .filter(Boolean),
    );
  }

  afterInit(namespace: Namespace): void {
    this.events.attach(namespace);
    // §11.3 — authenticate during the handshake (middleware), so a socket never exists in an
    // unauthenticated state and the client gets a real `connect_error` instead of a silent drop.
    namespace.use((socket, next) => {
      this.authenticate(socket as SupportSocket)
        .then(() => next())
        .catch((err: Error) => next(err));
    });
    namespace.on('connection', (socket: SupportSocket) => this.onConnection(socket));
  }

  handleDisconnect(client: SupportSocket): void {
    if (client.data?.expiryTimer) clearTimeout(client.data.expiryTimer);
    this.presence.unregister(client.id);
  }

  @SubscribeMessage('join')
  async join(@ConnectedSocket() client: SupportSocket, @MessageBody() payload: unknown): Promise<SupportSocketAck> {
    const conversationId = conversationIdOf(payload);
    if (!conversationId) return deny('VALIDATION_ERROR');
    try {
      if (client.data.isStaff) {
        // Re-checked on every join so a revoked permission stops working at the next join (§28.2).
        if (!(await this.staffAccess.hasAccess(BigInt(client.data.userId), client.data.role, 'read_only'))) {
          // Disconnect after the ack is flushed, so the client learns why.
          setTimeout(() => client.disconnect(true), 50);
          return deny('FORBIDDEN');
        }
        await this.service.getForAdmin(BigInt(conversationId));
        await client.join([supportRooms.conversation(conversationId), supportRooms.conversationStaff(conversationId)]);
      } else {
        await this.service.findOwnedOr404({ sub: client.data.userId }, BigInt(conversationId));
        await client.join(supportRooms.conversation(conversationId));
      }
      this.presence.markJoined(client.id, conversationId);
      return OK;
    } catch {
      // Same answer for "doesn't exist" and "not yours" (§28.1).
      return deny('RESOURCE_NOT_FOUND');
    }
  }

  @SubscribeMessage('leave')
  async leave(@ConnectedSocket() client: SupportSocket, @MessageBody() payload: unknown): Promise<SupportSocketAck> {
    const conversationId = conversationIdOf(payload);
    if (!conversationId) return deny('VALIDATION_ERROR');
    await client.leave(supportRooms.conversation(conversationId));
    if (client.data.isStaff) await client.leave(supportRooms.conversationStaff(conversationId));
    this.presence.markLeft(client.id, conversationId);
    return OK;
  }

  @SubscribeMessage('typing')
  typing(@ConnectedSocket() client: SupportSocket, @MessageBody() payload: unknown): SupportSocketAck {
    const conversationId = conversationIdOf(payload);
    if (!conversationId) return deny('VALIDATION_ERROR');
    if (!this.presence.hasJoined(client.id, conversationId)) return deny('RESOURCE_NOT_FOUND');
    const isTyping = (payload as { isTyping?: unknown }).isTyping === true;
    // "Stopped typing" is never throttled, so a dropped burst can't leave a stuck indicator.
    if (isTyping && this.throttled(client, `typing:${conversationId}`)) return OK;
    // Never persisted; never carries an admin identity to the customer.
    client.to(supportRooms.conversation(conversationId)).emit('typing', {
      conversationId,
      side: client.data.isStaff ? 'support' : 'customer',
      isTyping,
    });
    return OK;
  }

  @SubscribeMessage('viewing')
  viewing(@ConnectedSocket() client: SupportSocket, @MessageBody() payload: unknown): SupportSocketAck {
    const conversationId = conversationIdOf(payload);
    if (!conversationId) return deny('VALIDATION_ERROR');
    if (!this.presence.hasJoined(client.id, conversationId)) return deny('RESOURCE_NOT_FOUND');
    const visible = (payload as { visible?: unknown }).visible === true;
    // A "visible: false" must never be throttled away, or a stale "viewing" would suppress notifications.
    if (visible && this.throttled(client, `viewing:${conversationId}`)) return OK;
    this.presence.setViewing(client.id, conversationId, visible);
    return OK;
  }

  // ---- internals ----

  private async authenticate(socket: SupportSocket): Promise<void> {
    const origin = socket.handshake.headers.origin;
    // Browsers always send Origin; native/mobile clients don't. Same allowlist as main.ts enableCors.
    if (origin && this.allowedOrigins.size > 0 && !this.allowedOrigins.has(origin)) throw new Error('FORBIDDEN_ORIGIN');

    const token = socket.handshake.auth?.token ?? socket.handshake.query?.token;
    if (typeof token !== 'string' || !token) throw new Error('UNAUTHENTICATED');
    let payload: AccessTokenPayload;
    try {
      payload = this.tokens.verifyAccessToken(token);
    } catch {
      throw new Error('UNAUTHENTICATED');
    }

    let isStaff: boolean;
    if (payload.role === 'customer') {
      isStaff = false;
    } else if (await this.staffAccess.hasAccess(BigInt(payload.sub), payload.role, 'read_only')) {
      isStaff = true;
    } else {
      throw new Error('FORBIDDEN');
    }

    if (this.presence.socketCountFor(payload.sub) >= MAX_SOCKETS_PER_USER) throw new Error('TOO_MANY_CONNECTIONS');

    socket.data = { userId: payload.sub, role: payload.role, isStaff, lastSignalAt: {} };
    // §11.3 — access tokens live 15 minutes; the socket must not outlive its token. The client's
    // `auth` callback hands a refreshed token to socket.io's automatic reconnect.
    const msUntilExpiry = payload.exp * 1000 - Date.now();
    socket.data.expiryTimer = setTimeout(() => {
      socket.emit('auth-expired');
      socket.disconnect(true);
    }, Math.max(msUntilExpiry, 0));
    socket.data.expiryTimer.unref();
  }

  private onConnection(socket: SupportSocket): void {
    this.presence.register(socket.id, socket.data.userId);
    void socket.join(socket.data.isStaff ? supportRooms.staff() : supportRooms.user(socket.data.userId));
  }

  private throttled(client: SupportSocket, key: string): boolean {
    const now = Date.now();
    const last = client.data.lastSignalAt[key] ?? 0;
    if (now - last < SOCKET_SIGNAL_MIN_INTERVAL_MS) return true;
    client.data.lastSignalAt[key] = now;
    return false;
  }
}

function conversationIdOf(payload: unknown): string | null {
  if (typeof payload !== 'object' || payload === null) return null;
  const id = (payload as { conversationId?: unknown }).conversationId;
  return typeof id === 'string' && ID_PATTERN.test(id) ? id : null;
}
