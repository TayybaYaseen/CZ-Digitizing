import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';
import { useApiQuery } from '../../lib/use-api-query';
import { OfflineBanner } from '../../components/OfflineBanner';
import type { CreditTransactionDto } from '../../lib/types';

// Port of apps/web/app/account/credits/page.tsx — GET /api/credits/transactions (AC-12 sync target).
export function CreditsScreen() {
  const query = useApiQuery<CreditTransactionDto[]>('/api/credits/transactions?page=1&pageSize=50');

  return (
    <View style={styles.container}>
      <OfflineBanner />
      {query.status === 'loading' && <ActivityIndicator style={styles.center} />}
      {query.status === 'error' && <Text style={styles.error}>Could not load your credits.</Text>}
      {query.status === 'success' && (
        <FlatList
          data={query.data}
          keyExtractor={(item) => item.id}
          ListEmptyComponent={<Text style={styles.empty}>No credit activity yet.</Text>}
          renderItem={({ item }) => (
            <View style={styles.row}>
              <Text style={styles.type}>{item.type}</Text>
              <Text style={item.amountPkr >= 0 ? styles.positive : styles.negative}>{item.amountPkr >= 0 ? '+' : ''}{item.amountPkr} PKR</Text>
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
  row: { flexDirection: 'row', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderColor: '#eee' },
  type: { textTransform: 'capitalize' },
  positive: { color: '#1e7e34' },
  negative: { color: '#c0392b' },
});
