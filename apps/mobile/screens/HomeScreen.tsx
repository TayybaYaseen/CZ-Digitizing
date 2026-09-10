import { ActivityIndicator, FlatList, Image, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useApiQuery } from '../lib/use-api-query';
import { OfflineBanner } from '../components/OfflineBanner';
import type { DesignSummaryDto } from '../lib/types';
import type { HomeStackParamList } from '../navigation/types';

// docs/specs/2026-08-29-18-mobile-app-android-ios.md §5 Route(s): Home. Thin screen over the same
// /api/designs listing apps/web's Home page uses (docs/specs/2026-08-28-13-home-promotions-cms.md
// owns the home-sections business logic; this reuses its API one-for-one, no new logic).
type Props = NativeStackScreenProps<HomeStackParamList, 'Home'>;

export function HomeScreen({ navigation }: Props) {
  const query = useApiQuery<DesignSummaryDto[]>('/api/designs?page=1&pageSize=20');

  return (
    <View style={styles.container}>
      <OfflineBanner />
      {query.status === 'loading' && <ActivityIndicator style={styles.center} />}
      {query.status === 'error' && <Text style={styles.error}>Something went wrong loading designs.</Text>}
      {query.status === 'offline' && <Text style={styles.error}>You're offline.</Text>}
      {query.status === 'success' && (
        <FlatList
          data={query.data}
          keyExtractor={(item) => item.id}
          numColumns={2}
          refreshControl={<RefreshControl refreshing={false} onRefresh={query.refetch} />}
          ListEmptyComponent={<Text style={styles.empty}>No designs yet.</Text>}
          renderItem={({ item }) => (
            <Pressable style={styles.card} onPress={() => navigation.navigate('DesignDetail', { designId: item.id })}>
              <Image source={{ uri: item.previewImageUrl }} style={styles.image} />
              <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
              <Text style={styles.price}>PKR {item.salePricePkr ?? item.pricePkr}</Text>
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
