import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useApiQuery } from '../../lib/use-api-query';
import { OfflineBanner } from '../../components/OfflineBanner';
import type { CustomerSubscriptionDto } from '../../lib/types';

// Port of apps/web/app/account/subscription/page.tsx (read-only view this pass) — GET
// /api/subscriptions/current (AC-12 sync target). Plan-change/cancel actions deferred.
export function SubscriptionScreen() {
  const query = useApiQuery<CustomerSubscriptionDto>('/api/subscriptions/current');

  return (
    <View style={styles.container}>
      <OfflineBanner />
      {query.status === 'loading' && <ActivityIndicator style={styles.center} />}
      {query.status === 'error' && <Text style={styles.error}>Could not load your subscription.</Text>}
      {query.status === 'success' && (
        <View style={styles.body}>
          {query.data.planName ? (
            <>
              <Text style={styles.plan}>{query.data.planName}</Text>
              <Text style={styles.status}>Status: {query.data.status}</Text>
              {query.data.renewsAt ? <Text style={styles.renews}>Renews {new Date(query.data.renewsAt).toLocaleDateString()}</Text> : null}
            </>
          ) : (
            <Text style={styles.empty}>No active subscription.</Text>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  center: { marginTop: 40 },
  error: { color: '#c0392b', padding: 16, textAlign: 'center' },
  body: { padding: 16 },
  plan: { fontSize: 20, fontWeight: '700' },
  status: { color: '#555', marginTop: 4 },
  renews: { color: '#777', marginTop: 4 },
  empty: { textAlign: 'center', color: '#777', marginTop: 24 },
});
