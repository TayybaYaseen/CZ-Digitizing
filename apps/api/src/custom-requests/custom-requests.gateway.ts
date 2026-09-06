import { Logger } from '@nestjs/common';
import { ConnectedSocket, MessageBody, OnGatewayConnection, SubscribeMessage, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import { TokenService } from '../auth/services/token.service';
import { CustomRequestsService } from './custom-requests.service';

const STAFF_ROLES = new Set(['admin', 'freelancer', 'moderator']);

interface JoinRoomPayload {
  customRequestId: string;
}

interface SendMessagePayload {
  customRequestId: string;
  message: string;
}

interface TypingPayload {
  customRequestId: string;
  isTyping: boolean;
}

// docs/specs/2026-08-28-12-custom-design-requests.md AC-8 — real-time typing indicator + live
// message delivery on a custom request's chat thread. The first WebSocket feature in this codebase
// (no existing gateway to extend, per this feature's own research pass): a plain namespaced
// socket.io gateway rather than a shared library, since nothing else in the platform needs one yet.
@WebSocketGateway({ namespace: '/custom-requests', cors: { origin: true, credentials: true } })
export class CustomRequestsGateway implements OnGatewayConnection {
  private readonly logger = new Logger(CustomRequestsGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly tokens: TokenService,
    private readonly service: CustomRequestsService,
  ) {}

  // Auth happens at connection time (query token), not per-event — same access rules as the REST
  // routes: staff can join any thread, a customer only their own.
  handleConnection(client: Socket): void {
    const token = client.handshake.auth?.token ?? client.handshake.query?.token;
    if (typeof token !== 'string') {
      client.disconnect(true);
      return;
    }
    try {
      const payload = this.tokens.verifyAccessToken(token);
      client.data.userId = payload.sub;
      client.data.isStaff = STAFF_ROLES.has(payload.role);
    } catch {
      client.disconnect(true);
    }
  }

  @SubscribeMessage('join')
  async handleJoin(@ConnectedSocket() client: Socket, @MessageBody() payload: JoinRoomPayload): Promise<void> {
    try {
      // Ownership/staff check reuses the same guard listMessages already applies — never trusts
      // the room id blindly.
      await this.service.listMessages(payload.customRequestId, client.data.userId, client.data.isStaff);
      await client.join(this.room(payload.customRequestId));
    } catch {
      this.logger.warn(`User ${client.data.userId} denied join on custom request ${payload.customRequestId}`);
    }
  }

  @SubscribeMessage('typing')
  handleTyping(@ConnectedSocket() client: Socket, @MessageBody() payload: TypingPayload): void {
    client.to(this.room(payload.customRequestId)).emit('typing', { userId: client.data.userId, isTyping: payload.isTyping });
  }

  @SubscribeMessage('message')
  async handleMessage(@ConnectedSocket() client: Socket, @MessageBody() payload: SendMessagePayload): Promise<void> {
    const dto = await this.service.addMessage(payload.customRequestId, { message: payload.message }, client.data.userId, client.data.isStaff);
    this.server.to(this.room(payload.customRequestId)).emit('message', dto);
  }

  private room(customRequestId: string): string {
    return `custom-request:${customRequestId}`;
  }
}
