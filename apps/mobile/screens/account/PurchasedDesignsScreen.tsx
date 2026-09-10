import { ActivityIndicator, FlatList, Image, StyleSheet, Text, View } from 'react-native';
import { useApiQuery } from '../../lib/use-api-query';
import { OfflineBanner } from '../../components/OfflineBanner';
import type { PurchasedDesignDto } from '../../lib/types';

// Port of apps/web/app/account/purchased-designs/page.tsx — GET /api/users/purchased-designs
// (AC-10 sync target). Download itself follows the same private-file authorization/signed-URL
// rules as web (AC-5) — deferred in this pass (file-open/share-sheet UI), listing is real.
export function PurchasedDesignsScreen() {
  const query = useApiQuery<PurchasedDesignDto[]>('/api/users/purchased-designs');

  return (
    <View style={styles.container}>
      <OfflineBanner />
      {query.status === 'loading' && <ActivityIndicator style={styles.center} />}
      {query.status === 'error' && <Text style={styles.error}>Could not load your purchased designs.</Text>}
      {query.status === 'success' && (
        <FlatList
          data={query.data}
          keyExtractor={(item) => item.designId}
          ListEmptyComponent={<Text style={styles.empty}>No purchased designs yet.</Text>}
          renderItem={({ item }) => (
            <View style={styles.row}>
              <Image source={{ uri: item.previewImageUrl }} style={styles.thumb} />
              <Text style={styles.name}>{item.name}</Text>
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
  row: { flexDirection: 'row', alignItems: 'center', padding: 12, borderBottomWidth: 1, borderColor: '#eee' },
  thumb: { width: 48, height: 48, borderRadius: 8, backgroundColor: '#eee', marginRight: 12 },
  name: { fontWeight: '600' },
});
