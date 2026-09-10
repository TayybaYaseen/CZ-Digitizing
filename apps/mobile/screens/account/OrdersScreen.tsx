import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';
import { useApiQuery } from '../../lib/use-api-query';
import { OfflineBanner } from '../../components/OfflineBanner';
import type { OrderSummaryDto } from '../../lib/types';

// Port of apps/web/app/account/orders/page.tsx — GET /api/orders/user/history (AC-9 sync target).
export function OrdersScreen() {
  const query = useApiQuery<OrderSummaryDto[]>('/api/orders/user/history?page=1&pageSize=50');

  return (
    <View style={styles.container}>
      <OfflineBanner />
      {query.status === 'loading' && <ActivityIndicator style={styles.center} />}
      {query.status === 'error' && <Text style={styles.error}>Could not load your orders.</Text>}
      {query.status === 'success' && (
        <FlatList
          data={query.data}
          keyExtractor={(item) => item.id}
          ListEmptyComponent={<Text style={styles.empty}>No orders yet.</Text>}
          renderItem={({ item }) => (
            <View style={styles.row}>
              <Text style={styles.orderId}>Order #{item.id}</Text>
              <Text style={styles.status}>{item.status}</Text>
              <Text style={styles.total}>PKR {item.totalPkr}</Text>
            </View>
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
  orderId: { fontWeight: '600' },
  status: { color: '#555' },
  total: { color: '#1a1a2e' },
});
