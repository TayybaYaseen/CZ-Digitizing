import { useCallback } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { CustomRequestSummaryDto } from '@czd/shared-types';
import { useApiQuery } from '../../lib/use-api-query';
import { OfflineBanner } from '../../components/OfflineBanner';
import type { AccountStackParamList } from '../../navigation/types';

// Port of apps/web/app/account/custom-requests/page.tsx's list half — GET
// /api/custom-requests/user/history (aspect A-017). Unlike web's inline-expand, this app follows
// its own established "list pushes a detail screen" convention (see OrdersScreen/CreditsScreen vs.
// DesignDetailScreen) — the socket-chat detail lives in CustomRequestDetailScreen.
type Props = NativeStackScreenProps<AccountStackParamList, 'CustomRequests'>;

const STATUS_LABEL: Record<string, string> = {
  new: 'Submitted',
  reviewing: 'Under review',
  quote_sent: 'Quote ready',
  approved: 'Approved — awaiting payment',
  in_production: 'In production',
  ready: 'Ready',
  delivered: 'Delivered',
  completed: 'Completed',
  need_more_info: 'More info needed',
  revision_required: 'Revision in progress',
  cancelled: 'Cancelled',
};

export function CustomRequestsScreen({ navigation }: Props) {
  const query = useApiQuery<CustomRequestSummaryDto[]>('/api/custom-requests/user/history');

  useFocusEffect(
    useCallback(() => {
      query.refetch();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );

  return (
    <View style={styles.container}>
      <OfflineBanner />
      {query.status === 'loading' && <ActivityIndicator style={styles.center} />}
      {query.status === 'error' && <Text style={styles.error}>Could not load your custom requests.</Text>}
      {query.status === 'success' && (
        <FlatList
          data={query.data}
          keyExtractor={(item) => item.id}
          ListEmptyComponent={<Text style={styles.empty}>No custom requests yet.</Text>}
          renderItem={({ item }) => (
            <Pressable style={styles.row} onPress={() => navigation.navigate('CustomRequestDetail', { requestId: item.id })}>
              <View>
                <Text style={styles.requestNumber}>#{item.requestNumber}</Text>
                <Text style={styles.date}>{new Date(item.createdAt).toLocaleDateString()}</Text>
              </View>
              <Text style={styles.status}>{STATUS_LABEL[item.status] ?? item.status}</Text>
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
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderColor: '#eee' },
  requestNumber: { fontWeight: '600' },
  date: { color: '#777', fontSize: 12, marginTop: 2 },
  status: { fontSize: 12, fontWeight: '600', color: '#555', textTransform: 'uppercase' },
});
