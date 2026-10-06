import { Injectable, Logger } from '@nestjs/common';
import type {
  AdminSupportConversationSummaryDto,
  AdminSupportMessageDto,
  SupportConversationSummaryDto,
  SupportMessageDto,
  SupportReadEvent,
} from '@czd/shared-types';
import type { Namespace } from 'socket.io';
import { supportRooms } from './support-chat.constants';

// docs/specs/2026-10-06-21-customer-admin-live-chat.md §11.5 — every server → client push, in one
// place. The gateway hands over its namespace in afterInit(); the service layer only talks to this
// class, so REST writes and socket pushes never depend on each other (and the service is testable
// without a socket server — emits are simply no-ops until a namespace is attached).
//
// Customer and staff audiences always get separate emits with their own DTO shapes (§28.3):
// customers through their own `support:user:<id>` room, staff through `support:staff` (list rows)
// and `support:conversation:<id>:staff` (full messages). Nothing is ever broadcast to all sockets.
@Injectable()
export class SupportChatEventsService {
  private readonly logger = new Logger(SupportChatEventsService.name);
  private namespace: Namespace | null = null;

  attach(namespace: Namespace): void {
    this.namespace = namespace;
  }

  messageCreated(customerId: string, customerMessage: SupportMessageDto | null, staffMessage: AdminSupportMessageDto): void {
    this.safely(() => {
      if (customerMessage) this.namespace?.to(supportRooms.user(customerId)).emit('message', customerMessage);
      this.namespace?.to(supportRooms.conversationStaff(staffMessage.conversationId)).emit('message', staffMessage);
    });
  }

  conversationUpdated(customerId: string, customerSummary: SupportConversationSummaryDto, staffSummary: AdminSupportConversationSummaryDto): void {
    this.safely(() => {
      this.namespace?.to(supportRooms.user(customerId)).emit('conversation-updated', customerSummary);
      this.namespace?.to(supportRooms.staff()).emit('conversation-updated', staffSummary);
    });
  }

  read(customerId: string, event: SupportReadEvent): void {
    this.safely(() => {
      // Audience-neutral payload: both the customer's own room (other tabs) and the joined conversation room.
      this.namespace?.to([supportRooms.user(customerId), supportRooms.conversation(event.conversationId)]).emit('read', event);
    });
  }

  customerUnread(customerId: string, total: number): void {
    this.safely(() => this.namespace?.to(supportRooms.user(customerId)).emit('unread', { total }));
  }

  staffUnread(conversations: number): void {
    this.safely(() => this.namespace?.to(supportRooms.staff()).emit('unread', { conversations }));
  }

  private safely(emit: () => void): void {
    try {
      emit();
    } catch (err) {
      // A push failure must never fail the REST write that already committed.
      this.logger.error(`Support chat emit failed: ${(err as Error).message}`);
    }
  }
}
