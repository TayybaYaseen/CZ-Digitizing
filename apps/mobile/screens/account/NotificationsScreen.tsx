import { useCallback } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { apiFetch } from '../../lib/api-client';
import { useAuth } from '../../lib/auth-context';
import { useApiQuery } from '../../lib/use-api-query';
import { OfflineBanner } from '../../components/OfflineBanner';
import type { NotificationDto } from '../../lib/types';

// Port of apps/web/app/account/notifications/page.tsx — GET /api/notifications, PUT
// /api/notifications/:id/read (AC-13 sync target: read-state shared across web and app).
export function NotificationsScreen() {
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

  return (
    <View style={styles.container}>
      <OfflineBanner />
      {query.status === 'loading' && <ActivityIndicator style={styles.center} />}
      {query.status === 'error' && <Text style={styles.error}>Could not load your notifications.</Text>}
      {query.status === 'success' && (
        <FlatList
          data={query.data}
          keyExtractor={(item) => item.id}
          ListEmptyComponent={<Text style={styles.empty}>No notifications yet.</Text>}
          renderItem={({ item }) => (
            <Pressable style={[styles.row, !item.isRead && styles.unread]} onPress={() => !item.isRead && markRead(item.id)}>
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
  error: { color: '#c0392b', padding: 16, textAlign: 'center' },
  empty: { padding: 24, textAlign: 'center', color: '#777' },
  row: { padding: 16, borderBottomWidth: 1, borderColor: '#eee' },
  unread: { backgroundColor: '#f5f6ff' },
  title: { fontWeight: '600' },
  message: { color: '#555', marginTop: 2 },
});
