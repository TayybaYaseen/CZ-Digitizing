import { ActivityIndicator, FlatList, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useApiQuery } from '../lib/use-api-query';
import { OfflineBanner } from '../components/OfflineBanner';
import type { BundleSummaryDto } from '../lib/types';
import type { MoreStackParamList } from '../navigation/types';

// Port of apps/web/app/bundles/page.tsx — GET /api/bundles?pageSize=50. Closes A-023's §5
// Design Bundles gap.
type Props = NativeStackScreenProps<MoreStackParamList, 'Bundles'>;

export function BundlesScreen({ navigation }: Props) {
  const query = useApiQuery<BundleSummaryDto[]>('/api/bundles?pageSize=50');

  return (
    <View style={styles.container}>
      <OfflineBanner />
      {query.status === 'loading' && <ActivityIndicator style={styles.center} />}
      {query.status === 'error' && <Text style={styles.error}>Failed to load bundles.</Text>}
      {query.status === 'offline' && <Text style={styles.error}>You're offline.</Text>}
      {query.status === 'success' && (
        <FlatList
          data={query.data}
          keyExtractor={(item) => item.id}
          numColumns={2}
          ListEmptyComponent={<Text style={styles.empty}>No bundles available right now.</Text>}
          renderItem={({ item }) => (
            <Pressable style={styles.card} onPress={() => navigation.navigate('BundleDetail', { bundleId: item.id })}>
              {item.previewImageUrl ? <Image source={{ uri: item.previewImageUrl }} style={styles.image} /> : <View style={styles.image} />}
              <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
              <Text style={styles.price}>
                {item.salePricePkr ? `PKR ${item.salePricePkr}` : `PKR ${item.pricePkr}`}
              </Text>
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
  card: { flex: 1, margin: 8, maxWidth: '46%' },
  image: { width: '100%', aspectRatio: 1, borderRadius: 8, backgroundColor: '#eee' },
  name: { marginTop: 6, fontWeight: '600' },
  price: { color: '#1a1a2e' },
});
