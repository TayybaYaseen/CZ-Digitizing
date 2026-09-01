import { Injectable, Logger } from '@nestjs/common';

export interface NotificationPushInput {
  userId: bigint;
  title: string;
  message: string | null;
}

// AC-7 — FCM/APNs with deep linking. Ships as a stub with a clear extension seam: the push-token
// table this needs is owned by the Mobile App aspect (A-023, docs/specs/SPEC_INDEX.md), which is
// still `Blocked` and hasn't created it yet. Opt-in/opt-out is still fully enforced upstream via
// NotificationPreferenceService — AC-7's "in-app still created on opt-out" holds regardless of
// this stub. Never throws in a way the caller can't handle; always reports "not yet wired".
@Injectable()
export class NotificationPushService {
  private readonly logger = new Logger(NotificationPushService.name);

  async send(input: NotificationPushInput): Promise<string | undefined> {
    this.logger.log(`[push not yet wired — A-023 pending] userId=${input.userId} title="${input.title}"`);
    throw new Error('Push not yet wired — depends on A-023 (Mobile App) push-token table');
  }
}
