import { useCallback } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { apiFetch, ApiClientError } from '../../lib/api-client';
import { useAuth } from '../../lib/auth-context';
import { useApiQuery } from '../../lib/use-api-query';
import { getNotificationDeepLinkTarget, navigateToNotificationTarget } from '../../lib/notification-deep-link';
import { OfflineBanner } from '../../components/OfflineBanner';
import type { NotificationDto } from '../../lib/types';
import type { AccountStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<AccountStackParamList, 'Notifications'>;

// Port of apps/web/app/account/notifications/page.tsx — GET /api/notifications, PUT
// /api/notifications/:id/read (AC-13 sync target: read-state shared across web and app).
export function NotificationsScreen({ navigation }: Props) {
  const { accessToken } = useAuth();
  const query = useApiQuery<NotificationDto[]>('/api/notifications?page=1&pageSize=50');

  useFocusEffect(
    useCallback(() => {
      query.refetch();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );

  async function markRead(id: string) {
    try {
      await apiFetch(`/api/notifications/${id}/read`, { method: 'PUT', headers: { Authorization: `Bearer ${accessToken}` } });
      query.refetch();
    } catch {
      // Next refetch will surface the current server-side state either way.
    }
  }

  // Tapping a row marks it read and opens the screen it's about — the same mapping a tapped push
  // notification uses (lib/notification-deep-link.ts). Types that map back to this list stay here.
  function open(item: NotificationDto) {
    if (!item.isRead) void markRead(item.id);
    const data = {
      notificationType: item.notificationType,
      relatedOrderId: item.relatedOrderId ?? undefined,
      relatedQuoteId: item.relatedQuoteId ?? undefined,
      relatedCustomRequestId: item.relatedCustomRequestId ?? undefined,
    };
    if (getNotificationDeepLinkTarget(data).screen !== 'Notifications') navigateToNotificationTarget(data);
  }

  return (
    <View style={styles.container}>
      <OfflineBanner />
      {/* AC-9 — dedicated preference center, same pattern as apps/web's link from its
          notifications list to /account/notifications/settings. */}
      <Pressable style={styles.settingsLink} onPress={() => navigation.navigate('NotificationSettings')}>
        <Text style={styles.settingsLinkText}>Notification preferences</Text>
      </Pressable>
      {query.status === 'loading' && <ActivityIndicator style={styles.center} />}
      {query.status === 'error' && (
        // spec §5 UI states — "failed fetch shows retry with traceId".
        <View style={styles.errorContainer}>
          <Text style={styles.error}>Could not load your notifications.</Text>
          {query.error instanceof ApiClientError && query.error.error.traceId ? (
            <Text style={styles.traceId}>Reference: {query.error.error.traceId}</Text>
          ) : null}
          <Pressable style={styles.retryButton} onPress={() => query.refetch()}>
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      )}
      {query.status === 'success' && (
        <FlatList
          data={query.data}
          keyExtractor={(item) => item.id}
          ListEmptyComponent={<Text style={styles.empty}>No notifications yet.</Text>}
          renderItem={({ item }) => (
            <Pressable style={[styles.row, !item.isRead && styles.unread]} onPress={() => open(item)}>
              <Text style={styles.title}>{item.title}</Text>
              {item.message ? <Text style={styles.message}>{item.message}</Text> : null}
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  center: { marginTop: 40 },
  settingsLink: { padding: 16, borderBottomWidth: 1, borderColor: '#eee' },
  settingsLinkText: { color: '#1a1a2e', fontWeight: '600' },
  errorContainer: { padding: 16, alignItems: 'center' },
  error: { color: '#c0392b', textAlign: 'center' },
  traceId: { color: '#999', fontSize: 12, marginTop: 4 },
  retryButton: { marginTop: 12, borderWidth: 1, borderColor: '#c0392b', borderRadius: 6, paddingVertical: 6, paddingHorizontal: 16 },
  retryText: { color: '#c0392b', fontWeight: '600' },
  empty: { padding: 24, textAlign: 'center', color: '#777' },
  row: { padding: 16, borderBottomWidth: 1, borderColor: '#eee' },
  unread: { backgroundColor: '#f5f6ff' },
  title: { fontWeight: '600' },
  message: { color: '#555', marginTop: 2 },
});
