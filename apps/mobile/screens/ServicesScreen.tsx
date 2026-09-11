import { ActivityIndicator, FlatList, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useApiQuery } from '../lib/use-api-query';
import { OfflineBanner } from '../components/OfflineBanner';
import type { MainServiceDto } from '../lib/types';
import type { MoreStackParamList } from '../navigation/types';

// Port of apps/web/app/services/page.tsx — GET /api/services. Closes A-023's §5 Services gap.
type Props = NativeStackScreenProps<MoreStackParamList, 'Services'>;

export function ServicesScreen({ navigation }: Props) {
  const query = useApiQuery<MainServiceDto[]>('/api/services');

  return (
    <View style={styles.container}>
      <OfflineBanner />
      {query.status === 'loading' && <ActivityIndicator style={styles.center} />}
      {query.status === 'error' && <Text style={styles.error}>Could not load services.</Text>}
      {query.status === 'offline' && <Text style={styles.error}>You're offline.</Text>}
      {query.status === 'success' && (
        <FlatList
          data={query.data}
          keyExtractor={(item) => item.id}
          ListEmptyComponent={<Text style={styles.empty}>No services published yet — check back soon.</Text>}
          renderItem={({ item }) => (
            <Pressable style={styles.card} onPress={() => navigation.navigate('ServiceDetail', { slug: item.slug })}>
              <Image source={{ uri: item.visualImageUrl }} style={styles.image} />
              <View style={styles.body}>
                <Text style={styles.name}>{item.name}</Text>
                <Text style={styles.description} numberOfLines={2}>{item.description}</Text>
              </View>
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
  card: { margin: 12, borderRadius: 8, overflow: 'hidden', borderWidth: 1, borderColor: '#eee' },
  image: { width: '100%', aspectRatio: 2, backgroundColor: '#eee' },
  body: { padding: 12 },
  name: { fontSize: 16, fontWeight: '700' },
  description: { color: '#555', marginTop: 4 },
});
