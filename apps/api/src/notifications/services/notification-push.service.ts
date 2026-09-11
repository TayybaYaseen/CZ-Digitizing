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

    const validTokens = tokens.filter(({ token }) => {
      const valid = this.isExpoPushToken(token);
      if (!valid) this.logger.warn(`Skipping malformed Expo push token for userId=${input.userId}`);
      return valid;
    });
    if (validTokens.length === 0) return undefined;

    const messages = validTokens.map(({ token }) => ({ to: token, title: input.title, body: input.message ?? undefined, sound: 'default' }));

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
    // Expo's contract: the response array is positionally aligned with the request array, one
    // ticket per message sent — see https://docs.expo.dev/push-notifications/sending-notifications/.
    const tickets = body.data ?? [];

    const succeeded: string[] = [];
    const otherErrors: string[] = [];
    await Promise.all(
      tickets.map(async (ticket, i) => {
        if (ticket.status === 'ok') {
          succeeded.push(ticket.id ?? 'ok');
          return;
        }
        // §8 risk #1 — DeviceNotRegistered is Expo's (and transitively FCM/APNs's) own signal that
        // this token belongs to an uninstalled app or a revoked registration; nothing else in this
        // system can detect that on its own, so this is the one reliable place to prune it.
        if (ticket.details?.error === 'DeviceNotRegistered') {
          const deadToken = validTokens[i]?.token;
          if (deadToken) {
            await this.pushTokens.pruneStale(deadToken);
            this.logger.log(`Pruned stale push token for userId=${input.userId} (DeviceNotRegistered)`);
          }
          return;
        }
        otherErrors.push(ticket.message ?? ticket.details?.error ?? 'unknown error');
      }),
    );

    // A partial success (this user has multiple devices, only some failed/were pruned) still counts
    // as delivered — the same "at least one channel worked" posture dispatchAll() already applies
    // across channels, now applied across this one user's multiple registered devices.
    if (succeeded.length > 0) return succeeded.join(',');
    if (otherErrors.length > 0) throw new Error(`Expo push send failed: ${otherErrors[0]}`);
    // Every ticket was DeviceNotRegistered (now pruned) and nothing else failed — equivalent to the
    // "no registered device" no-op above, not a delivery failure to retry.
    return undefined;
  }
}
