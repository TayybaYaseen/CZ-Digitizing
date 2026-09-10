import { Injectable, Logger } from '@nestjs/common';
import { PushTokensService } from '../../users/push-tokens/push-tokens.service';

export interface NotificationPushInput {
  userId: bigint;
  title: string;
  message: string | null;
}

interface ExpoPushTicket {
  status: 'ok' | 'error';
  id?: string;
  message?: string;
  details?: { error?: string };
}

const EXPO_PUSH_ENDPOINT = 'https://exp.host/--/api/v2/push/send';
// Matches Expo's own token shape, e.g. "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]" (also accepts
// the older "ExpoPushToken[...]" form) — same validation Expo's own SDK performs client-side
// before ever making the HTTP call.
const EXPO_PUSH_TOKEN_RE = /^Expo(nent)?PushToken\[.+\]$/;

// docs/specs/2026-08-29-18-mobile-app-android-ios.md §3 (aspect A-023). Real Expo push send:
// resolves the user's registered device tokens (apps/mobile registers these on login/foreground
// via POST /api/users/push-token — see PushTokensService) and dispatches to Expo's push API
// (https://exp.host/--/api/v2/push/send), which itself fans out to FCM (Android) and APNs (iOS) —
// the standard Expo-managed path, avoiding hand-rolling two native push SDKs (architecture
// §Notifications System: "FCM + APNs"). Calls Expo's HTTP API directly with `fetch` rather than
// the `expo-server-sdk` npm package — that package ships ESM-only with no CJS build, which is
// incompatible with this repo's CommonJS Jest/ts-jest toolchain (a dynamic `import()` of a pure-
// ESM module throws inside Jest's VM sandbox without `--experimental-vm-modules`); the HTTP
// contract itself is small and stable, so a thin direct client is both simpler and testable with a
// plain `fetch` mock. Never throws in a way the caller can't handle: a user with no registered
// device (not yet installed the app, or push not opted in) is a normal, expected no-op.
@Injectable()
export class NotificationPushService {
  private readonly logger = new Logger(NotificationPushService.name);

  constructor(private readonly pushTokens: PushTokensService) {}

  isExpoPushToken(token: string): boolean {
    return EXPO_PUSH_TOKEN_RE.test(token);
  }

  async send(input: NotificationPushInput): Promise<string | undefined> {
    const tokens = await this.pushTokens.listTokensForUser(input.userId);
    if (tokens.length === 0) {
      this.logger.log(`No registered push tokens for userId=${input.userId}; skipping push`);
      return undefined;
    }

    const messages = tokens
      .filter(({ token }) => {
        const valid = this.isExpoPushToken(token);
        if (!valid) this.logger.warn(`Skipping malformed Expo push token for userId=${input.userId}`);
        return valid;
      })
      .map(({ token }) => ({ to: token, title: input.title, body: input.message ?? undefined, sound: 'default' }));
    if (messages.length === 0) return undefined;

    // Expo's HTTP push endpoint call; a rejected/failed request here is a transport failure,
    // propagated to the caller (NotificationDispatchService) so its existing retry/backoff handles
    // it — same contract every other channel service (email/sms/whatsapp) already follows.
    const res = await fetch(EXPO_PUSH_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(messages),
    });
    if (!res.ok) {
      throw new Error(`Expo push send failed: HTTP ${res.status}`);
    }
    const body = (await res.json()) as { data?: ExpoPushTicket[]; errors?: unknown[] };
    const tickets = body.data ?? [];

    const firstError = tickets.find((t) => t.status === 'error');
    if (firstError) {
      throw new Error(`Expo push send failed: ${firstError.message ?? firstError.details?.error ?? 'unknown error'}`);
    }

    return tickets.map((t) => t.id ?? 'error').join(',');
  }
}
