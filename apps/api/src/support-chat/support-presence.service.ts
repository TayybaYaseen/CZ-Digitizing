import { Injectable } from '@nestjs/common';

interface SocketState {
  userId: string;
  joined: Set<string>;
  viewing: Set<string>;
}

// docs/specs/2026-10-06-21-customer-admin-live-chat.md §11.4/§17.3 — which socket has joined / is
// actively looking at which conversation. In-memory by design: the API runs as a single instance
// (spec §36 risk #1 — scaling out needs the socket.io Redis adapter and a shared store for this).
@Injectable()
export class SupportPresenceService {
  private readonly sockets = new Map<string, SocketState>();

  register(socketId: string, userId: string): void {
    this.sockets.set(socketId, { userId, joined: new Set(), viewing: new Set() });
  }

  unregister(socketId: string): void {
    this.sockets.delete(socketId);
  }

  socketCountFor(userId: string): number {
    let count = 0;
    for (const state of this.sockets.values()) if (state.userId === userId) count += 1;
    return count;
  }

  markJoined(socketId: string, conversationId: string): void {
    this.sockets.get(socketId)?.joined.add(conversationId);
  }

  markLeft(socketId: string, conversationId: string): void {
    const state = this.sockets.get(socketId);
    state?.joined.delete(conversationId);
    state?.viewing.delete(conversationId);
  }

  hasJoined(socketId: string, conversationId: string): boolean {
    return this.sockets.get(socketId)?.joined.has(conversationId) ?? false;
  }

  // Only a socket that passed the join check may claim to be viewing (the gateway enforces this).
  setViewing(socketId: string, conversationId: string, visible: boolean): void {
    const state = this.sockets.get(socketId);
    if (!state) return;
    if (visible) state.viewing.add(conversationId);
    else state.viewing.delete(conversationId);
  }

  isViewing(conversationId: string, userId: string): boolean {
    for (const state of this.sockets.values()) {
      if (state.userId === userId && state.viewing.has(conversationId)) return true;
    }
    return false;
  }
}
